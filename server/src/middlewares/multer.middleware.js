import multer from "multer";


//primarily used for uploading files

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "/media")
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix)  }
})

export const upload = multer({
  storage,
})