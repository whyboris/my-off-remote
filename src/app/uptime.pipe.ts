import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration',
  standalone: true // Modern Angular applications prefer standalone pipes
})
export class UptimePipe implements PipeTransform {
  // The first argument is the template value, followed by optional parameters
  transform(duration: number): string {

      const days = Math.floor(duration / 86400);
      const hours =  Math.floor((duration % 86400) / 3600);
      const minutes =  Math.floor((duration % 3600) / 60);

      if (days) {
        return days + "d " + hours + "h " + minutes + "m";
      } else if (hours) {
        return hours + "h " + minutes + "m";
      } else if (minutes) {
        return minutes + "m";
      } else {
        return "?"
      }

  }
}
