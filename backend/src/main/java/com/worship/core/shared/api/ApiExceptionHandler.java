package com.worship.core.shared.api;

import com.worship.core.shared.application.CapabilityException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(CapabilityException.class)
    ResponseEntity<ApiError> capability(CapabilityException e) {
        return ResponseEntity.status(e.status()).body(new ApiError(e.code(), e.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class,
        org.springframework.web.multipart.support.MissingServletRequestPartException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
        org.springframework.web.method.annotation.HandlerMethodValidationException.class,
        jakarta.validation.ConstraintViolationException.class})
    ResponseEntity<ApiError> validation(Exception e) {
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED", "Invalid request"));
    }
    @ExceptionHandler({org.springframework.web.HttpMediaTypeNotSupportedException.class,
        org.springframework.web.HttpMediaTypeNotAcceptableException.class,
        org.springframework.web.HttpRequestMethodNotSupportedException.class,
        org.springframework.web.servlet.resource.NoResourceFoundException.class})
    ResponseEntity<ApiError> protocol(Exception e){return ResponseEntity.status(((org.springframework.web.ErrorResponse)e).getStatusCode()).body(new ApiError("REQUEST_REJECTED","Unsupported request"));}
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ResponseEntity<ApiError> stale(Exception e) {
        return ResponseEntity.status(409).body(new ApiError("VERSION_CONFLICT", "Source has changed"));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> integrity(Exception e) {
        return ResponseEntity.status(409).body(new ApiError("CONSTRAINT_CONFLICT", "Operation conflicts with current state"));
    }
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> fileSize(Exception e){return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED","File too large"));}
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception e){return ResponseEntity.internalServerError().body(new ApiError("INTERNAL_ERROR","Operation failed"));}
    @ExceptionHandler(com.worship.core.integration.youtube.ProviderFailure.class)
    ResponseEntity<ApiError> provider(Exception e){return ResponseEntity.status(503).body(new ApiError("EXTERNAL_PROVIDER_FAILURE","Provider operation failed"));}
}
