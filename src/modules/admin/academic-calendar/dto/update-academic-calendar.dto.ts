import { PartialType } from '@nestjs/swagger';
import { CreateAcademicCalendarDto } from './create-academic-calendar.dto';

export class UpdateAcademicCalendarDto extends PartialType(
  CreateAcademicCalendarDto,
) {}
