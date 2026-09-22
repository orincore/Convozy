import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AppConfig } from '../../config/configuration';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AppException, NotFoundAppException } from '../../common/utils/app-exception';
import { InstagramService } from './instagram.service';

@Controller('instagram')
export class InstagramController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /** Called by the dashboard (with the user's JWT) to get the Instagram authorize URL. */
  @Get('oauth/start')
  async oauthStart(@CurrentUser() user: RequestUser): Promise<{ url: string }> {
    const url = await this.instagramService.createAuthorizationUrl(user.workspaceId);
    return { url };
  }

  /**
   * Instagram redirects here after consent - a plain browser navigation, so
   * there's no JWT on this request. The workspace comes from `state`
   * instead (see InstagramService.createAuthorizationUrl/consumeState).
   */
  @Public()
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const appBaseUrl = this.configService.get('appBaseUrl', { infer: true });

    if (error) {
      res.redirect(
        `${appBaseUrl}/app?instagram_error=${encodeURIComponent(errorDescription ?? error)}`,
      );
      return;
    }

    if (!code || !state) {
      res.redirect(`${appBaseUrl}/app?instagram_error=${encodeURIComponent('Missing code or state')}`);
      return;
    }

    try {
      await this.instagramService.handleCallback(code, state);
      res.redirect(`${appBaseUrl}/app?instagram=connected`);
    } catch (err) {
      const message = err instanceof AppException ? (err.getResponse() as { message: string }).message : 'Could not connect your Instagram account.';
      res.redirect(`${appBaseUrl}/app?instagram_error=${encodeURIComponent(message)}`);
    }
  }

  @Get('accounts')
  listAccounts(@CurrentUser() user: RequestUser) {
    return this.instagramService.listAccounts(user.workspaceId);
  }

  /** Recent posts for the "specific posts" automation scope picker. */
  @Get('accounts/:id/media')
  async listMedia(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    if (!(await this.instagramService.accountBelongsToWorkspace(id, user.workspaceId))) {
      throw new NotFoundAppException('INSTAGRAM_ACCOUNT_NOT_FOUND', 'This Instagram account was not found in your workspace.');
    }
    return this.instagramService.listRecentMedia(id);
  }
}
