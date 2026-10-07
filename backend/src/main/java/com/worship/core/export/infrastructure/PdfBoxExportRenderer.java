package com.worship.core.export.infrastructure;

import java.io.*;
import java.util.*;
import com.worship.core.export.application.ExportRenderer;
import com.worship.core.setlist.application.SetlistService.SetlistView;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.*;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PdfBoxExportRenderer implements ExportRenderer {
    private final int maxPages;
    private final long maxOutputBytes;

    public PdfBoxExportRenderer(){this(500,104857600);}

    @Autowired
    public PdfBoxExportRenderer(@Value("${worship.exports.max-pages:500}") int maxPages,
            @Value("${worship.exports.max-output-bytes:104857600}") long maxOutputBytes){
        if(maxPages<=0||maxOutputBytes<=0||maxOutputBytes>Integer.MAX_VALUE)
            throw new IllegalArgumentException("Invalid export resource limits");
        this.maxPages=maxPages;
        this.maxOutputBytes=maxOutputBytes;
    }

    @Override public byte[] pdf(SetlistView source){return pdf(source,Map.of());}

    @Override public byte[] pdf(SetlistView source,Map<Long,ScoreContent> scores){
        List<PDDocument> loadedScores=new ArrayList<>();
        try(var document=new PDDocument();
            var fontBytes=getClass().getResourceAsStream("/fonts/NotoSansKR-VF.ttf");
            var output=new LimitedOutput(maxOutputBytes)){
            if(fontBytes==null)throw new IllegalStateException("Export font missing");
            var font=PDType0Font.load(document,fontBytes,true);
            document.getDocumentInformation().setTitle(source.title());
            document.getDocumentInformation().setSubject("Immutable Document "+source.documentId()+" source version "+source.version());
            try(var layout=new Layout(document,font)){
                layout.text(source.title(),18);
                layout.text("Document "+source.documentId()+" | Source version "+source.version(),10);
                layout.text(source.notes(),11);
                layout.space();
                layout.text("Song order",14);
                for(var item:source.items())layout.text((item.position()+1)+". "+item.song().title(),12);
                for(var item:source.items()){
                    layout.newPage();
                    layout.text((item.position()+1)+". "+item.song().title(),14);
                    layout.text("Artist: "+value(item.song().artist()),11);
                    layout.text("Key: "+value(item.key())+" | BPM: "+value(item.bpm())+" | Sessions: "+String.join(", ",item.sessions()),11);
                    layout.text("Notes: "+value(item.notes()),11);
                    layout.text("SongForm v"+item.songForm().version(),11);
                    for(var block:item.songForm().blocks()){
                        layout.text("  "+block.section()+" x"+block.repeat()+" ["+block.id()+"]",11);
                        if(block.cue()!=null)layout.text("  Cue: "+block.cue(),11);
                        if(block.calling()!=null)layout.text("  Calling: "+block.calling(),11);
                        if(block.note()!=null)layout.text("  Note: "+block.note(),11);
                    }
                    if(item.reference()!=null){
                        layout.text("Reference: "+value(item.reference().title()),11);
                        layout.text(item.reference().url(),10);
                    }
                    if(item.score()!=null){
                        layout.text("Score: "+item.score().filename(),11);
                        layout.suspend();
                        var score=scores.get(item.score().id());
                        if(score==null||!score.mediaType().equals(item.score().mediaType()))
                            throw new IllegalStateException("Snapshot score bytes missing or mismatched");
                        appendScore(document,score,loadedScores);
                    }
                }
            }
            // Imported resource streams must stay open until the target is saved.
            document.save(output);
            return output.bytes();
        }catch(IOException failure){
            throw new IllegalStateException("PDF rendering failed",failure);
        }finally{
            for(var score:loadedScores)try{score.close();}catch(IOException ignored){
                org.slf4j.LoggerFactory.getLogger(PdfBoxExportRenderer.class).warn("Could not close an in-memory score PDF");
            }
        }
    }

    private void appendScore(PDDocument target,ScoreContent score,List<PDDocument> loaded)throws IOException{
        if("application/pdf".equals(score.mediaType())){
            var source=Loader.loadPDF(score.bytes());
            loaded.add(source);
            if(source.isEncrypted()||source.getNumberOfPages()==0)throw new IOException("Invalid score PDF");
            checkPages(target,source.getNumberOfPages());
            for(var page:source.getPages()){
                var copied=target.importPage(page);
                copied.setResources(page.getResources());
                copied.getCOSObject().removeItem(COSName.AA);
                copied.getCOSObject().removeItem(COSName.getPDFName("AF"));
                copied.setAnnotations(staticAnnotations(page));
            }
        }else if(Set.of("image/png","image/jpeg").contains(score.mediaType())){
            checkPages(target,1);
            var image=PDImageXObject.createFromByteArray(target,score.bytes(),"score");
            if(image.getWidth()<=0||image.getHeight()<=0||(long)image.getWidth()*image.getHeight()>25000000)
                throw new IOException("Invalid score image dimensions");
            var page=new PDPage(PDRectangle.A4);
            target.addPage(page);
            float scale=Math.min((PDRectangle.A4.getWidth()-72)/image.getWidth(),(PDRectangle.A4.getHeight()-72)/image.getHeight());
            float width=image.getWidth()*scale,height=image.getHeight()*scale;
            try(var content=new PDPageContentStream(target,page)){
                content.drawImage(image,(PDRectangle.A4.getWidth()-width)/2,(PDRectangle.A4.getHeight()-height)/2,width,height);
            }
        }else throw new IOException("Unsupported score format");
    }

    /** Keep ordinary printed annotation appearances, not executable actions/attachments. */
    private static List<PDAnnotation> staticAnnotations(PDPage page)throws IOException{
        Set<String> allowed=Set.of("Text","FreeText","Line","Square","Circle","Polygon","PolyLine","Highlight",
            "Underline","Squiggly","StrikeOut","Stamp","Caret","Ink","Widget","Link");
        var result=new ArrayList<PDAnnotation>();
        for(var annotation:page.getAnnotations()){
            if(!allowed.contains(annotation.getSubtype()))continue;
            var copy=new COSDictionary(annotation.getCOSObject());
            for(String key:List.of("A","AA","P","Parent","Dest","Popup","IRT","AF"))copy.removeItem(COSName.getPDFName(key));
            result.add(PDAnnotation.createAnnotation(copy));
        }
        return result;
    }

    private void checkPages(PDDocument document,int additional)throws IOException{
        if(additional>maxPages-document.getNumberOfPages())throw new IOException("Export page limit exceeded");
    }

    private static String value(Object value){return value==null?"-":value.toString();}

    private class Layout implements AutoCloseable {
        private final PDDocument document;
        private final PDType0Font font;
        private PDPageContentStream content;
        private float y;
        Layout(PDDocument document,PDType0Font font)throws IOException{this.document=document;this.font=font;newPage();}
        void newPage()throws IOException{
            suspend();
            checkPages(document,1);
            var next=new PDPage(PDRectangle.A4);
            document.addPage(next);
            content=new PDPageContentStream(document,next);
            y=PDRectangle.A4.getHeight()-48;
            draw("Worship Setlist | "+document.getNumberOfPages(),9,28);
        }
        void suspend()throws IOException{if(content!=null){content.close();content=null;}}
        private void draw(String line,float size,float at)throws IOException{
            content.beginText();content.setFont(font,size);content.newLineAtOffset(48,at);content.showText(line);content.endText();
        }
        void space()throws IOException{y-=10;if(y<55)newPage();}
        void text(String value,float size)throws IOException{
            if(value==null||value.isEmpty())return;
            for(String paragraph:value.replace("\r\n","\n").replace('\r','\n').split("\n",-1)){
                StringBuilder line=new StringBuilder();float width=0;
                for(int code:paragraph.codePoints().toArray()){
                    String glyph=Character.isISOControl(code)?" ":new String(Character.toChars(code));float advance;
                    try{advance=font.getStringWidth(glyph)*size/1000;}
                    catch(IllegalArgumentException unsupported){glyph="[U+"+Integer.toHexString(code).toUpperCase(Locale.ROOT)+"]";advance=font.getStringWidth(glyph)*size/1000;}
                    if(width+advance>PDRectangle.A4.getWidth()-96&&!line.isEmpty()){emit(line.toString(),size);line.setLength(0);width=0;}
                    line.append(glyph);width+=advance;
                }
                emit(line.toString(),size);
            }
        }
        private void emit(String line,float size)throws IOException{if(y-size-5<48)newPage();draw(line,size,y);y-=size+5;}
        public void close()throws IOException{suspend();}
    }

    private static class LimitedOutput extends OutputStream {
        private final ByteArrayOutputStream delegate=new ByteArrayOutputStream();
        private final long limit;
        LimitedOutput(long limit){this.limit=limit;}
        @Override public void write(int value)throws IOException{check(1);delegate.write(value);}
        @Override public void write(byte[] bytes,int offset,int length)throws IOException{check(length);delegate.write(bytes,offset,length);}
        private void check(int additional)throws IOException{if(additional>limit-delegate.size())throw new IOException("Export output size limit exceeded");}
        byte[] bytes(){return delegate.toByteArray();}
    }
}
