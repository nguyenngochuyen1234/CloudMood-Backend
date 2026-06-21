import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin/admin.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('app-versions')
  getAppVersions(@Query('platform') platform?: string) {
    return this.adminService.getAppVersions({
      activeOnly: true,
      platform,
    });
  }
}
