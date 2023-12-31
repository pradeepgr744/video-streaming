import { v2 as cloudinary } from "cloudinary"
import fs from "fs"//file system builtin function


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfull
        //console.log("file is uploaded on cloudinary ", response.url);
        fs.unlinkSync(localFilePath)
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}

// const deleteOnCloudinary = async (localFilePath) => {

//     (uploadOnCloudinary)
//     .delete_resources(['bwpbjzaaz59kuvlnvx7k', 'jyrecdflklelkamidu2v'], 
//       { type: 'upload', resource_type: 'image' })
//     .then(console.log);

// }




export { uploadOnCloudinary}