package com.worship.core.score.application;
import java.io.*;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import com.worship.core.shared.application.Errors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
@Component
public class ScoreFileValidator {
    private final long maxBytes;
    public ScoreFileValidator(@Value("${worship.scores.max-bytes:20971520}") long maxBytes){this.maxBytes=maxBytes;}
    public void validate(String filename,String media,byte[] data){
        if(filename==null||filename.isBlank()||filename.length()>255||filename.contains("\r")||filename.contains("\n")||data==null||data.length==0||data.length>maxBytes)throw Errors.invalid("Invalid score file or size");
        try{
            if("application/pdf".equals(media)){
                if(data.length<5||!new String(data,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))throw Errors.invalid("Invalid PDF");
                try(var pdf=Loader.loadPDF(data)){if(pdf.isEncrypted()||pdf.getNumberOfPages()==0)throw Errors.invalid("Invalid PDF");for(var page:pdf.getPages())if(page.getMediaBox()==null)throw Errors.invalid("Invalid PDF page");}
            }else if("image/png".equals(media)||"image/jpeg".equals(media)){
                try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(data))){var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw Errors.invalid("Invalid image");var reader=readers.next();try{reader.setInput(stream);String format=reader.getFormatName();if("image/png".equals(media)&&!"png".equalsIgnoreCase(format)||"image/jpeg".equals(media)&&!"JPEG".equalsIgnoreCase(format)||reader.getWidth(0)<=0||reader.getHeight(0)<=0||(long)reader.getWidth(0)*reader.getHeight(0)>25000000||reader.read(0)==null)throw Errors.invalid("Invalid image or MIME");}finally{reader.dispose();}}
            }else throw Errors.invalid("Allowed score formats are PDF, PNG and JPEG");
        }catch(IOException failure){throw Errors.invalid("Invalid score file");}
    }
}
