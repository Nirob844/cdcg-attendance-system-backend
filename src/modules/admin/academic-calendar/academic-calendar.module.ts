import { Module } from '@nestjs/common';
import { AcademicCalendarService } from './academic-calendar.service';
import { AcademicCalendarController } from './academic-calendar.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GoogleCalendarService } from 'src/common/lib/calendar/GoogleCalendarService';

@Module({
  imports: [PrismaModule],
  controllers: [AcademicCalendarController],
  providers: [AcademicCalendarService, GoogleCalendarService],
})
export class AcademicCalendarModule {}
