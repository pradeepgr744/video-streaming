import { Router } from "express";
import {
    getProfiles,
    addProfile,
    modifyProfile,
    deleteProfile,
    selectProfile,
    getActiveProfile,
    updateProfileAvatar,
    getPresetAvatars,
    selectPresetAvatar
} from "../controllers/profile.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// every profile route requires a logged-in account
router.use(verifyJWT);

router.route("/").get(getProfiles).post(addProfile);
router.route("/active").get(getActiveProfile);
router.route("/avatars/presets").get(getPresetAvatars);
router.route("/:profileId").patch(modifyProfile).delete(deleteProfile);
router.route("/:profileId/select").post(selectProfile);
router.route("/:profileId/avatar").patch(upload.single("avatar"), updateProfileAvatar);
router.route("/:profileId/avatar/select").patch(selectPresetAvatar);

export default router;