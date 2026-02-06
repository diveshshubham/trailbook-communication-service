import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { InvitationPermission } from '../../../models/album-invitation.schema';

export class UpdateInvitationDto {
  @IsOptional()
  @IsEnum(InvitationPermission)
  permission?: InvitationPermission;

  @IsOptional()
  @IsBoolean()
  autoConnect?: boolean;
}
