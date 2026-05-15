import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

// Standard AWS environment variables (Server-side only)
const region = process.env.AWS_REGION || "us-east-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
    if (typeof window === 'undefined') {
        console.warn("AWS credentials are missing. AWS SDK will attempt to use default credential providers (e.g. IAM roles).");
    }
}

const s3Config: S3ClientConfig = {
    region,
};

if (accessKeyId && secretAccessKey) {
    s3Config.credentials = {
        accessKeyId,
        secretAccessKey,
    };
}

export const s3Client = new S3Client(s3Config);

export const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "";
