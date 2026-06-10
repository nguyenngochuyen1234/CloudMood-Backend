import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GetUser } from './get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('register-admin')
  @UseGuards(JwtAuthGuard)
  registerAdmin(
    @GetUser('role') role: string,
    @Body() registerDto: RegisterDto,
  ) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Admin access only');
    }

    return this.authService.registerAdmin(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
