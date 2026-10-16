import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from youtube import _seconds, _video, video_id  # noqa: E402


# #
# run

if __name__ == "__main__":
    # link
    assert video_id(text="https://youtu.be/jJEmRv_b93s") == "jJEmRv_b93s"
    assert video_id(text="https://www.youtube.com/watch?v=sk_ACKNjq_o&t=30") == "sk_ACKNjq_o"
    assert video_id(text="https://youtube.com/shorts/hGpOABdr-VE") == "hGpOABdr-VE"
    assert video_id(text="그 사랑") is None

    # duration
    assert _seconds(duration="PT6M5S") == 365
    assert _seconds(duration="PT1H3M14S") == 3794
    assert _seconds(duration="P0D") == 0

    # video
    video = _video(
        item={
            "id": "jJEmRv_b93s",
            "snippet": {"title": "그 사랑 &amp; 은혜", "channelTitle": "MARKERS WORSHIP", "publishedAt": "2017-01-01T00:00:00Z"},
            "contentDetails": {"duration": "PT6M22S"},
            "statistics": {},
        },
    )
    assert video["title"] == "그 사랑 & 은혜"
    assert video["duration_seconds"] == 382
    assert video["view_count"] is None

    print("ok")
