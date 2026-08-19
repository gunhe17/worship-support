from fastapi import HTTPException, status


class AppException(HTTPException):
    def __init__(self, status_code: int, detail: str, error_code: str):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code


ERRORS: dict[str, tuple[int, str]] = {
    "WORSHIP_NOT_FOUND": (status.HTTP_404_NOT_FOUND, "예배를 찾을 수 없습니다."),
    "SONG_NOT_FOUND": (status.HTTP_404_NOT_FOUND, "찬양을 찾을 수 없습니다."),
    "SECTION_NOT_FOUND": (status.HTTP_404_NOT_FOUND, "구간을 찾을 수 없습니다."),
    "POST_NOT_FOUND": (status.HTTP_404_NOT_FOUND, "포스트를 찾을 수 없습니다."),
    "ARRANGEMENT_NOT_FOUND": (status.HTTP_404_NOT_FOUND, "곡 구성을 찾을 수 없습니다."),
    "DUPLICATE_SONG": (status.HTTP_409_CONFLICT, "이미 등록된 찬양입니다."),
    "INVALID_KEY": (status.HTTP_422_UNPROCESSABLE_ENTITY, "유효하지 않은 Key입니다."),
    "AI_SERVICE_ERROR": (status.HTTP_503_SERVICE_UNAVAILABLE, "AI 서비스 오류가 발생했습니다."),
    "YOUTUBE_API_ERROR": (status.HTTP_503_SERVICE_UNAVAILABLE, "YouTube API 오류가 발생했습니다."),
    "EXPORT_FAILED": (status.HTTP_500_INTERNAL_SERVER_ERROR, "자료 생성에 실패했습니다."),
    "UNAUTHORIZED": (status.HTTP_401_UNAUTHORIZED, "인증이 필요합니다."),
    "FORBIDDEN": (status.HTTP_403_FORBIDDEN, "접근 권한이 없습니다."),
}


def raise_app_error(error_code: str) -> None:
    status_code, detail = ERRORS[error_code]
    raise AppException(status_code=status_code, detail=detail, error_code=error_code)
