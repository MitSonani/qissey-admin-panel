import { supabase } from "./supabase";

/**
 * Uploads an image to a specified Supabase bucket and folder.
 * @param file The file to upload
 * @param bucket The storage bucket name
 * @param folder Optional folder path within the bucket
 */
export async function uploadImage(file: File, bucket: string = "product-images", folder: string = "") {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file);

        if (error) {
            throw error;
        }

        // Return the public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error(`Supabase Storage Upload Error (${bucket}/${folder}):`, error);
        throw new Error(`Failed to upload image to ${bucket}${folder ? '/' + folder : ''}`);
    }
}

export async function uploadProductImage(file: File) {
    return uploadImage(file, "product-images", "products");
}
