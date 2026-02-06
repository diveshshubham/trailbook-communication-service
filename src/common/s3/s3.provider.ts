import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = 'S3_CLIENT';

export const S3Provider = {
  provide: S3_CLIENT,
  useFactory: () => {
    console.log('AWS_REGION:', process.env.AWS_REGION);
    console.log('AWS_ACCESS_KEY_ID exists:', !!process.env.AWS_ACCESS_KEY_ID);
    console.log(
      'AWS_SECRET_ACCESS_KEY exists:',
      !!process.env.AWS_SECRET_ACCESS_KEY,
    );

    return new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  },
};
