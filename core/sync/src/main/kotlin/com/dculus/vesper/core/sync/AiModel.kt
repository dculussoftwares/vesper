package com.dculus.vesper.core.sync

/**
 * Raw text generation for the AI block builder. `:app` provides the Gemini one, so the AI SDK never ships in Kids;
 * tests use a fake.
 */
interface AiModel {
    /** Returns the model's JSON text for [sentence]. Throws on any failure (network, quota, App Check, safety). */
    suspend fun generate(sentence: String): String
}
