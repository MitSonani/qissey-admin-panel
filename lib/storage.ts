/**
 * Uploads an image to a specified AWS S3 bucket and folder via a pre-signed URL.
 * @param file The file to upload
 * @param bucket The storage bucket name
 * @param folder Optional folder path within the bucket
 */
export async function uploadImage(file: File, bucket: string = "", folder: string = "") {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    try {
        // 1. Get pre-signed URL from our API
        const response = await fetch("/api/upload", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                fileName,
                fileType: file.type,
                bucket,
                folder,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to get upload URL");
        }

        const { uploadUrl, publicUrl } = await response.json();

        // 2. Upload the file directly to S3 using the pre-signed URL
        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: {
                "Content-Type": file.type,
            },
        });

        if (!uploadResponse.ok) {
            throw new Error("Failed to upload file to S3");
        }

        return publicUrl;
    } catch (error) {
        console.error(`AWS S3 Storage Upload Error (${folder}):`, error);
        throw new Error(`Failed to upload image to AWS S3`);
    }
}

export async function uploadProductImage(file: File) {
    return uploadImage(file, "", "products");
}

