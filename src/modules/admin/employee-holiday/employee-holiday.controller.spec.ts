import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeHolidayController } from './employee-holiday.controller';
import { EmployeeHolidayService } from './employee-holiday.service';

describe('EmployeeHolidayController', () => {
  let controller: EmployeeHolidayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeHolidayController],
      providers: [EmployeeHolidayService],
    }).compile();

    controller = module.get<EmployeeHolidayController>(
      EmployeeHolidayController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
