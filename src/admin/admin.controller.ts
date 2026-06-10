import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminService } from './admin.service';
import { R2Service } from '../upload/r2.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleGuard } from './admin-role.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly r2: R2Service,
  ) {}

  // ==================== DASHBOARD ====================
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ==================== USERS ====================
  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body('role') role: string) {
    return this.adminService.updateUserRole(id, role);
  }

  // ==================== EMOTIONS ====================
  @Get('emotions')
  getEmotions() {
    return this.adminService.getEmotions();
  }

  @Post('emotions')
  createEmotion(@Body() body: any) {
    return this.adminService.createEmotion({ ...body, id: BigInt(body.id) });
  }

  @Patch('emotions/:id')
  updateEmotion(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.updateEmotion(BigInt(id), body);
  }

  @Delete('emotions/:id')
  deleteEmotion(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteEmotion(BigInt(id));
  }

  // ==================== EMOJI TYPES ====================
  @Get('emoji-types')
  getEmojiTypes() {
    return this.adminService.getEmojiTypes();
  }

  @Post('emoji-types')
  createEmojiType(@Body() body: any) {
    return this.adminService.createEmojiType({ ...body, id: BigInt(body.id) });
  }

  @Patch('emoji-types/:id')
  updateEmojiType(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.updateEmojiType(BigInt(id), body);
  }

  @Delete('emoji-types/:id')
  deleteEmojiType(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteEmojiType(BigInt(id));
  }

  // ==================== UPLOAD ====================
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Chỉ chấp nhận file ảnh'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder: string,
  ) {
    const safeFolder = /^[a-z0-9_-]+$/i.test(folder) ? folder : 'emojis';
    const url = await this.r2.upload(file.buffer, file.originalname, file.mimetype, safeFolder);
    return { url };
  }

  // ==================== EMOJIS ====================
  @Get('emojis')
  getEmojis() {
    return this.adminService.getEmojis();
  }

  @Post('emojis/bulk')
  bulkCreateEmojis(@Body() body: { emojis: any[] }) {
    return this.adminService.bulkCreateEmojis(body.emojis);
  }

  @Post('emojis')
  createEmoji(@Body() body: any) {
    return this.adminService.createEmoji({
      ...body,
      id: BigInt(body.id),
      typeId: BigInt(body.typeId),
      emotionId: BigInt(body.emotionId),
    });
  }

  @Patch('emojis/:id')
  updateEmoji(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data: any = { ...body };
    if (body.typeId) data.typeId = BigInt(body.typeId);
    if (body.emotionId) data.emotionId = BigInt(body.emotionId);
    return this.adminService.updateEmoji(BigInt(id), data);
  }

  @Delete('emojis/:id')
  deleteEmoji(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteEmoji(BigInt(id));
  }

  // ==================== THEMES ====================
  @Get('themes')
  getThemes() {
    return this.adminService.getThemes();
  }

  @Post('themes')
  createTheme(@Body() body: any) {
    return this.adminService.createTheme(body);
  }

  @Patch('themes/:id')
  updateTheme(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateTheme(id, body);
  }

  @Delete('themes/:id')
  deleteTheme(@Param('id') id: string) {
    return this.adminService.deleteTheme(id);
  }

  // ==================== THEME IMAGES ====================
  @Post('theme-images')
  createThemeImage(@Body() body: { themeId: string; type: string; imageUrl: string }) {
    return this.adminService.createThemeImage(body);
  }

  @Delete('theme-images/:id')
  deleteThemeImage(@Param('id') id: string) {
    return this.adminService.deleteThemeImage(id);
  }

  // ==================== EVENTS ====================
  @Get('events')
  getEvents() {
    return this.adminService.getEvents();
  }

  @Post('events')
  createEvent(@Body() body: any) {
    return this.adminService.createEvent(body);
  }

  @Patch('events/:id')
  updateEvent(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateEvent(id, body);
  }

  @Delete('events/:id')
  deleteEvent(@Param('id') id: string) {
    return this.adminService.deleteEvent(id);
  }
}
