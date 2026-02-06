import { IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { InvitationPermission } from '../../../models/album-invitation.schema';

export class InviteUserDto {
  @IsNotEmpty()
  @IsString()
  albumId: string;

  // One of these must be provided
  @IsOptional()
  @IsString()
  userId?: string; // If user exists on platform

  @IsOptional()
  @IsString()
  email?: string; // If user doesn't exist yet

  @IsOptional()
  @IsString()
  phone?: string; // If user doesn't exist yet

  @IsOptional()
  @IsEnum(InvitationPermission)
  permission?: InvitationPermission = InvitationPermission.CONTRIBUTOR;

  @IsOptional()
  @IsBoolean()
  autoConnect?: boolean = true; // Auto-connect when user accepts
}
