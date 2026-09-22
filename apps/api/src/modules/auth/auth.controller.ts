import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfig } from '../../config/configuration';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Kicks off the Google OAuth dialog. Link this from the frontend's "Continue with Google" button. */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // The guard redirects to Google before this body ever runs.
  }

  /**
   * Google redirects here after consent. We issue our own JWTs, then hand
   * the frontend a one-time exchange code via redirect (never the tokens
   * themselves — see AuthService.issueExchangeCode).
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const profile = req.user as GoogleProfile;
    const tokens = await this.authService.loginOrRegisterWithGoogle(profile);
    const code = await this.authService.issueExchangeCode(tokens);

    const callbackUrl = this.configService.get('frontendOAuthCallbackUrl', { infer: true });
    res.redirect(`${callbackUrl}?code=${code}`);
  }

  /** Frontend calls this with the code from the callback redirect to get real tokens. */
  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  exchange(@Body() dto: ExchangeCodeDto) {
    return this.authService.consumeExchangeCode(dto.code);
  }

  /**
   * Called by the frontend's fetch wrapper whenever an API call gets a 401
   * with an access token that's simply expired (15m TTL) — trades a still-
   * valid refresh token for a new pair, so the dashboard session survives
   * without forcing a re-login every 15 minutes.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }
}
