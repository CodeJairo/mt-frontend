import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { NotificationService } from './notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't intercept 401 Unauthorized if you plan to handle auth separately
      if (error.status !== 401) {
        let errorMessage = 'Ha ocurrido un error inesperado.';

        if (error.error instanceof ErrorEvent) {
          // Client-side or network error
          errorMessage = `Error de red: ${error.error.message}`;
        } else if (error.error && typeof error.error.message === 'string') {
          // Backend error with clear message (like the ones we throw from NestJS)
          errorMessage = error.error.message;
        } else if (error.status !== 0) {
          // Other backend error
          errorMessage = `Error del servidor (${error.status})`;
        }

        notificationService.error(errorMessage);
      }

      return throwError(() => error);
    }),
  );
};
