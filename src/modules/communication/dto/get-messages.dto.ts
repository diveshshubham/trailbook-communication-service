import { IsOptional, IsString, IsNumber, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMessagesDto {
  // otherUserId is a path parameter, not a query parameter
  // So it's not included in this DTO

  // Cursor-based pagination
  @IsOptional()
  @IsString()
  cursor?: string; // Message ID to start from (for pagination)

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100) // Max 100 messages per request for performance
  limit?: number = 50; // Default 50 messages

  // Direction: 'before' to get older messages, 'after' to get newer messages
  @IsOptional()
  @IsString()
  @IsIn(['before', 'after'])
  direction?: 'before' | 'after' = 'before'; // Default: load older messages
}
