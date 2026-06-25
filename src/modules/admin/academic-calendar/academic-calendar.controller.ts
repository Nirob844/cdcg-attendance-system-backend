import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { AcademicCalendarService } from './academic-calendar.service';
import { CreateAcademicCalendarDto } from './dto/create-academic-calendar.dto';
import { UpdateAcademicCalendarDto } from './dto/update-academic-calendar.dto';

@Controller('academic-calendar')
export class AcademicCalendarController {
  constructor(
    private readonly academicCalendarService: AcademicCalendarService,
  ) {}

  @Post()
  async create(@Body() dto: CreateAcademicCalendarDto) {
    return this.academicCalendarService.createEvent(dto);
  }

  @Get()
  async findAll(@Query('month') month?: string, @Query('year') year?: string) {
    const now = new Date();
    const yearNum = year ? Number(year) : now.getFullYear();

    if (month) {
      const monthNum = Number(month);
      const startDate = new Date(
        Date.UTC(yearNum, monthNum - 1, 1),
      ).toISOString();
      const endDate = new Date(
        Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999),
      ).toISOString();
      return this.academicCalendarService.getEventsWithHolidays(
        startDate,
        endDate,
      );
    }
    // fallback: return all events if no month provided
    return this.academicCalendarService.getEventsWithHolidays(
      undefined,
      undefined,
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicCalendarDto,
  ) {
    return this.academicCalendarService.updateEvent(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.academicCalendarService.deleteEvent(id);
  }
}
