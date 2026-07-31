import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User, calculateIsKid } from "../models/user.model.js";
import { Image } from "../models/image.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";
import {
    MAX_PROFILES,
    MIN_PROFILES,
    SUPPORTED_LANGUAGE_CODES,
    ACTIVE_PROFILE_COOKIE
} from "../constants.js";

const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "Strict"
};

// strip the pin hash before sending a profile back to the client,
// and always recompute isKid so an ageing profile stays accurate
const sanitizeProfile = (profile) => {
    const obj = profile.toObject ? profile.toObject() : profile;
    return {
        _id: obj._id,
        name: obj.name,
        dob: obj.dob,
        isKid: calculateIsKid(obj.dob),
        language: obj.language,
        avatar: obj.avatar,
        hasPin: Boolean(obj.pin),
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
    };
};

const findProfileOrThrow = (user, profileId) => {
    const profile = user.profiles.id(profileId);
    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }
    return profile;
};

// GET /profiles -> profile1, profile2, profile3, profile4 (whatever exists, max 4)
const getProfiles = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const profiles = user.profiles.map(sanitizeProfile);

    return res
        .status(200)
        .json(new ApiResponse(200, { profiles }, "Profiles fetched successfully"));
});

// POST /profiles -> add profile: name, dob, language, pin (key to lock the profile)
const addProfile = asyncHandler(async (req, res) => {
    const { name, dob, language, pin } = req.body;

    if (!name?.trim() || !dob) {
        throw new ApiError(400, "Name and date of birth are required");
    }

    if (isNaN(new Date(dob).getTime())) {
        throw new ApiError(400, "Invalid date of birth");
    }

    if (language && !SUPPORTED_LANGUAGE_CODES.includes(language)) {
        throw new ApiError(400, "Unsupported language");
    }

    if (!pin || !/^\d{4,6}$/.test(pin)) {
        throw new ApiError(400, "A 4-6 digit pin is required to lock this profile");
    }

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.profiles.length >= MAX_PROFILES) {
        throw new ApiError(400, `A maximum of ${MAX_PROFILES} profiles is allowed per account`);
    }

    user.profiles.push({
        name: name.trim(),
        dob,
        language: language || "en_US",
        pin
    });

    await user.save({ validateBeforeSave: false });

    const createdProfile = user.profiles[user.profiles.length - 1];

    return res
        .status(201)
        .json(new ApiResponse(201, { profile: sanitizeProfile(createdProfile) }, "Profile added successfully"));
});

// PATCH /profiles/:profileId -> modify name/dob/language/pin.
// also used as the gateway to delete a profile (same validated flow, see deleteProfile below)
const modifyProfile = asyncHandler(async (req, res) => {
    const { profileId } = req.params;
    const { name, dob, language, currentPin, newPin } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const profile = findProfileOrThrow(user, profileId);

    // if the profile is locked, the correct key must be supplied before any change is made
    const isPinCorrect = await profile.isPinCorrect(currentPin);
    if (!isPinCorrect) {
        throw new ApiError(401, "Incorrect profile pin");
    }

    if (name !== undefined) {
        if (!name.trim()) throw new ApiError(400, "Name cannot be empty");
        profile.name = name.trim();
    }

    if (dob !== undefined) {
        if (isNaN(new Date(dob).getTime())) throw new ApiError(400, "Invalid date of birth");
        profile.dob = dob;
    }

    if (language !== undefined) {
        if (!SUPPORTED_LANGUAGE_CODES.includes(language)) throw new ApiError(400, "Unsupported language");
        profile.language = language;
    }

    if (newPin !== undefined) {
        if (!/^\d{4,6}$/.test(newPin)) throw new ApiError(400, "A 4-6 digit pin is required");
        profile.pin = newPin;
    }

    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, { profile: sanitizeProfile(profile) }, "Profile updated successfully"));
});

// DELETE /profiles/:profileId -> goes through the same pin-checked flow as modifyProfile,
// then removes the profile. At least MIN_PROFILES must always remain on the account.
const deleteProfile = asyncHandler(async (req, res) => {
    const { profileId } = req.params;
    const { currentPin } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const profile = findProfileOrThrow(user, profileId);

    const isPinCorrect = await profile.isPinCorrect(currentPin);
    if (!isPinCorrect) {
        throw new ApiError(401, "Incorrect profile pin");
    }

    if (user.profiles.length <= MIN_PROFILES) {
        throw new ApiError(400, `At least ${MIN_PROFILES} profile must remain on the account`);
    }

    profile.deleteOne();
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Profile deleted successfully"));
});

// POST /profiles/:profileId/select -> validate this profile's key, then mark it
// active for this device only (httpOnly cookie), Netflix-profile-switch style
const selectProfile = asyncHandler(async (req, res) => {
    const { profileId } = req.params;
    const { pin } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const profile = findProfileOrThrow(user, profileId);

    const isPinCorrect = await profile.isPinCorrect(pin);
    if (!isPinCorrect) {
        throw new ApiError(401, "Incorrect profile pin");
    }

    return res
        .status(200)
        .cookie(ACTIVE_PROFILE_COOKIE, String(profile._id), cookieOptions)
        .json(new ApiResponse(200, { profile: sanitizeProfile(profile) }, "Profile selected successfully"));
});

// GET /profiles/active -> whichever profile is active on this device
const getActiveProfile = asyncHandler(async (req, res) => {
    const activeProfileId = req.cookies?.[ACTIVE_PROFILE_COOKIE];

    if (!activeProfileId) {
        return res
            .status(200)
            .json(new ApiResponse(200, { profile: null }, "No active profile selected on this device"));
    }

    const user = await User.findById(req.user._id);
    const profile = user?.profiles?.id(activeProfileId);

    if (!profile) {
        return res
            .status(200)
            .clearCookie(ACTIVE_PROFILE_COOKIE, cookieOptions)
            .json(new ApiResponse(200, { profile: null }, "No active profile selected on this device"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { profile: sanitizeProfile(profile) }, "Active profile fetched successfully"));
});

// PATCH /profiles/:profileId/avatar -> upload/replace a profile's picture (multipart, field name "avatar")
const updateProfileAvatar = asyncHandler(async (req, res) => {
    const { profileId } = req.params;
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar image file is missing");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        if (fs.existsSync(avatarLocalPath)) fs.unlinkSync(avatarLocalPath);
        throw new ApiError(404, "User not found");
    }

    const profile = user.profiles.id(profileId);
    if (!profile) {
        if (fs.existsSync(avatarLocalPath)) fs.unlinkSync(avatarLocalPath);
        throw new ApiError(404, "Profile not found");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar?.url) {
        throw new ApiError(500, "Something went wrong while uploading the avatar");
    }

    profile.avatar = avatar.url;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, { profile: sanitizeProfile(profile) }, "Profile avatar updated successfully"));
});

// GET /profiles/avatars/presets -> avatar options pulled from the "images" collection
const getPresetAvatars = asyncHandler(async (req, res) => {
    const imageDoc = await Image.findOne();

    const avatars = (imageDoc?.avatars || []).map((url, index) => ({
        id: `avatar${index + 1}`,
        url
    }));

    return res
        .status(200)
        .json(new ApiResponse(200, { avatars }, "Preset avatars fetched successfully"));
});

// PATCH /profiles/:profileId/avatar/select -> pick one of the preset avatars by URL
// (no file upload needed, just { "avatarUrl": "https://api.dicebear.com/..." })
const selectPresetAvatar = asyncHandler(async (req, res) => {
    const { profileId } = req.params;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
        throw new ApiError(400, "avatarUrl is required");
    }

    const imageDoc = await Image.findOne();
    const isValidAvatar = imageDoc?.avatars?.includes(avatarUrl);

    if (!isValidAvatar) {
        throw new ApiError(400, "Invalid avatarUrl - must be one of the preset avatars");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const profile = findProfileOrThrow(user, profileId);

    profile.avatar = avatarUrl;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, { profile: sanitizeProfile(profile) }, "Profile avatar updated successfully"));
});

export {
    getProfiles,
    addProfile,
    modifyProfile,
    deleteProfile,
    selectProfile,
    getActiveProfile,
    updateProfileAvatar,
    getPresetAvatars,
    selectPresetAvatar
};