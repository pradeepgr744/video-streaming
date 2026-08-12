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


// Default avatar
const DEFAULT_AVATAR =
    "https://img.magnific.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-gender-neutral-silhouette-profile-picture-suitable-social-media-profiles-icons-screensavers-as-templatex9xa_719432-2191.jpg?semt=ais_test_b&w=740&q=80";


// Remove sensitive profile data before sending response
const sanitizeProfile = (profile) => {

    const obj = profile.toObject
        ? profile.toObject()
        : profile;

    return {
        _id: obj._id,
        name: obj.name,
        dob: obj.dob,
        isKid: calculateIsKid(obj.dob),
        language: obj.language,
        avatar: obj.avatar || DEFAULT_AVATAR,

        // true only when a PIN exists
        hasPin: Boolean(obj.pin),

        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
    };
};


// Find profile
const findProfileOrThrow = (user, profileId) => {

    const profile = user.profiles.id(profileId);

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    return profile;
};


// ============================================================
// GET /profiles
// ============================================================

const getProfiles = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const profiles = user.profiles.map((profile) => {
        const obj = profile.toObject();

        return {
            _id: obj._id,
            name: obj.name,
            dob: obj.dob,
            isKid: calculateIsKid(obj.dob),
            language: obj.language,
            avatar: obj.avatar || DEFAULT_AVATAR,
            hasPin: Boolean(obj.pin),
            createdAt: obj.createdAt,
            updatedAt: obj.updatedAt
        };
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { profiles },
                "Profiles fetched successfully"
            )
        );
});


// ============================================================
// POST /profiles
// Create profile
// ============================================================

const addProfile = asyncHandler(async (req, res) => {

    const {
        name,
        dob,
        language,
        pin,
        avatar
    } = req.body;


    // --------------------------------------------------------
    // Validate name and DOB
    // --------------------------------------------------------

    if (!name?.trim() || !dob) {
        throw new ApiError(
            400,
            "Name and date of birth are required"
        );
    }


    if (isNaN(new Date(dob).getTime())) {
        throw new ApiError(
            400,
            "Invalid date of birth"
        );
    }


    // --------------------------------------------------------
    // Validate language
    // --------------------------------------------------------

    if (
        language &&
        !SUPPORTED_LANGUAGE_CODES.includes(language)
    ) {
        throw new ApiError(
            400,
            "Unsupported language"
        );
    }


    // --------------------------------------------------------
    // PIN
    //
    // pin = "1234" -> valid
    // pin = "0000" -> valid
    // pin = ""     -> no PIN
    // pin omitted  -> no PIN
    // --------------------------------------------------------

    if (
        pin &&
        !/^\d{4,6}$/.test(pin)
    ) {
        throw new ApiError(
            400,
            "PIN must be 4-6 digits"
        );
    }


    // --------------------------------------------------------
    // Get authenticated user
    // --------------------------------------------------------

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(
            404,
            "User not found"
        );
    }


    // --------------------------------------------------------
    // Maximum profiles
    // --------------------------------------------------------

    if (user.profiles.length >= MAX_PROFILES) {
        throw new ApiError(
            400,
            `A maximum of ${MAX_PROFILES} profiles is allowed per account`
        );
    }


    // --------------------------------------------------------
    // Create profile
    // --------------------------------------------------------

    user.profiles.push({
        name: name.trim(),

        dob,

        language: language || "en_US",

        // Empty string becomes null
        // Actual PIN will be hashed by profileSchema pre-save
        pin: pin?.trim() || null,

        avatar: avatar || DEFAULT_AVATAR
    });


    await user.save({
        validateBeforeSave: false
    });


    const createdProfile =
        user.profiles[user.profiles.length - 1];


    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                {
                    profile: sanitizeProfile(createdProfile)
                },
                "Profile added successfully"
            )
        );
});


// ============================================================
// PATCH /profiles/:profileId
// Modify profile
// ============================================================

const modifyProfile = asyncHandler(async (req, res) => {
    const { profileId } = req.params;

    const {
        name,
        dob,
        language,
        avatar,
        currentPin,
        currentpin
    } = req.body;

    // Get authenticated user
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Find profile
    const profile = findProfileOrThrow(user, profileId);

    // Get current PIN from request
    const pin = currentPin ?? currentpin;

    // Verify PIN only if profile has a PIN
    if (profile.pin) {
        const isPinCorrect = await profile.isPinCorrect(pin);

        if (!isPinCorrect) {
            throw new ApiError(
                401,
                "Incorrect profile pin"
            );
        }
    }

    // Update name
    if (name !== undefined) {
        if (!name.trim()) {
            throw new ApiError(
                400,
                "Name cannot be empty"
            );
        }

        profile.name = name.trim();
    }

    // Update DOB
    if (dob !== undefined) {
        if (isNaN(new Date(dob).getTime())) {
            throw new ApiError(
                400,
                "Invalid date of birth"
            );
        }

        profile.dob = dob;
    }

    // Update language
    if (language !== undefined) {
        if (!SUPPORTED_LANGUAGE_CODES.includes(language)) {
            throw new ApiError(
                400,
                "Unsupported language"
            );
        }

        profile.language = language;
    }

    // Update avatar
    if (avatar !== undefined) {
        if (!avatar.trim()) {
            throw new ApiError(
                400,
                "Avatar cannot be empty"
            );
        }

        profile.avatar = avatar.trim();
    }

    await user.save({
        validateBeforeSave: false
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    profile: sanitizeProfile(profile)
                },
                "Profile updated successfully"
            )
        );
});

// ============================================================
// DELETE /profiles/:profileId
// ============================================================

const deleteProfile = asyncHandler(async (req, res) => {

    const { profileId } = req.params;

    const {
        currentPin,
        currentpin
    } = req.body;


    const user =
        await User.findById(req.user._id);


    if (!user) {
        throw new ApiError(
            404,
            "User not found"
        );
    }


    const profile =
        findProfileOrThrow(user, profileId);


    // --------------------------------------------------------
    // Verify PIN only if profile has PIN
    // --------------------------------------------------------

    const pin =
        currentPin ?? currentpin;


    if (profile.pin) {

        const isPinCorrect =
            await profile.isPinCorrect(pin);

        if (!isPinCorrect) {
            throw new ApiError(
                401,
                "Incorrect profile pin"
            );
        }
    }


    // --------------------------------------------------------
    // Minimum profile check
    // --------------------------------------------------------

    if (user.profiles.length <= MIN_PROFILES) {

        throw new ApiError(
            400,
            `At least ${MIN_PROFILES} profile must remain on the account`
        );
    }


    profile.deleteOne();


    await user.save({
        validateBeforeSave: false
    });


    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Profile deleted successfully"
            )
        );
});


// ============================================================
// POST /profiles/:profileId/select
// ============================================================

const selectProfile = asyncHandler(async (req, res) => {

    const { profileId } = req.params;

    const { pin } = req.body;


    const user =
        await User.findById(req.user._id);


    if (!user) {
        throw new ApiError(
            404,
            "User not found"
        );
    }


    const profile =
        findProfileOrThrow(user, profileId);


    // --------------------------------------------------------
    // Verify PIN only if profile has PIN
    // --------------------------------------------------------

    if (profile.pin) {

        const isPinCorrect =
            await profile.isPinCorrect(pin);

        if (!isPinCorrect) {
            throw new ApiError(
                401,
                "Incorrect profile pin"
            );
        }
    }


    return res
        .status(200)
        .cookie(
            ACTIVE_PROFILE_COOKIE,
            String(profile._id),
            cookieOptions
        )
        .json(
            new ApiResponse(
                200,
                {
                    profile: sanitizeProfile(profile)
                },
                "Profile selected successfully"
            )
        );
});


// ============================================================
// GET /profiles/active
// ============================================================

const getActiveProfile = asyncHandler(async (req, res) => {

    const activeProfileId =
        req.cookies?.[ACTIVE_PROFILE_COOKIE];


    if (!activeProfileId) {

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { profile: null },
                    "No active profile selected on this device"
                )
            );
    }


    const user =
        await User.findById(req.user._id);


    const profile =
        user?.profiles?.id(activeProfileId);


    if (!profile) {

        return res
            .status(200)
            .clearCookie(
                ACTIVE_PROFILE_COOKIE,
                cookieOptions
            )
            .json(
                new ApiResponse(
                    200,
                    { profile: null },
                    "No active profile selected on this device"
                )
            );
    }


    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    profile: sanitizeProfile(profile)
                },
                "Active profile fetched successfully"
            )
        );
});


// ============================================================
// PATCH /profiles/:profileId/avatar
// Upload profile avatar
// ============================================================

const updateProfileAvatar = asyncHandler(async (req, res) => {

    const { profileId } = req.params;

    const avatarLocalPath =
        req.file?.path;


    if (!avatarLocalPath) {

        throw new ApiError(
            400,
            "Avatar image file is missing"
        );
    }


    const user =
        await User.findById(req.user._id);


    if (!user) {

        if (fs.existsSync(avatarLocalPath)) {
            fs.unlinkSync(avatarLocalPath);
        }

        throw new ApiError(
            404,
            "User not found"
        );
    }


    const profile =
        user.profiles.id(profileId);


    if (!profile) {

        if (fs.existsSync(avatarLocalPath)) {
            fs.unlinkSync(avatarLocalPath);
        }

        throw new ApiError(
            404,
            "Profile not found"
        );
    }


    const avatar =
        await uploadOnCloudinary(
            avatarLocalPath
        );


    if (!avatar?.url) {

        throw new ApiError(
            500,
            "Something went wrong while uploading the avatar"
        );
    }


    profile.avatar =
        avatar.url;


    await user.save({
        validateBeforeSave: false
    });


    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    profile: sanitizeProfile(profile)
                },
                "Profile avatar updated successfully"
            )
        );
});


// ============================================================
// GET /profiles/avatars/presets
// ============================================================

const getPresetAvatars = asyncHandler(async (req, res) => {

    const imageDoc =
        await Image.findOne();


    const avatars =
        (imageDoc?.avatars || []).map(
            (url, index) => ({
                id: `avatar${index + 1}`,
                url
            })
        );


    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { avatars },
                "Preset avatars fetched successfully"
            )
        );
});


// ============================================================
// PATCH /profiles/:profileId/avatar/select
// ============================================================

const selectPresetAvatar = asyncHandler(async (req, res) => {

    const { profileId } =
        req.params;

    const { avatarUrl } =
        req.body;


    if (!avatarUrl) {

        throw new ApiError(
            400,
            "avatarUrl is required"
        );
    }


    const imageDoc =
        await Image.findOne();


    const isValidAvatar =
        imageDoc?.avatars?.includes(
            avatarUrl
        );


    if (!isValidAvatar) {

        throw new ApiError(
            400,
            "Invalid avatarUrl - must be one of the preset avatars"
        );
    }


    const user =
        await User.findById(req.user._id);


    if (!user) {

        throw new ApiError(
            404,
            "User not found"
        );
    }


    const profile =
        findProfileOrThrow(
            user,
            profileId
        );


    profile.avatar =
        avatarUrl;


    await user.save({
        validateBeforeSave: false
    });


    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    profile: sanitizeProfile(profile)
                },
                "Profile avatar updated successfully"
            )
        );
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
