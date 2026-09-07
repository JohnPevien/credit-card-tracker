import { z } from "zod";

const positiveRevisionSchema = z.number().int().positive();

export const proofUploadClaimSchema = z.object({
    expectedRevision: positiveRevisionSchema,
    originalFilename: z.string().min(1).max(1_024),
    contentType: z.string().min(1).max(100),
    sizeBytes: z.number().int(),
});

export const proofFinalizeSchema = proofUploadClaimSchema.extend({
    path: z.string().min(1).max(1_024),
});

export const proofRemovalSchema = z.object({
    expectedRevision: positiveRevisionSchema,
});
