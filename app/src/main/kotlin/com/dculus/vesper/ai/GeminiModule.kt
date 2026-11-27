package com.dculus.vesper.ai

import com.dculus.vesper.core.sync.AiModel
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
internal object GeminiModule {
    /** Lazy: the Firebase AI client is created on the first call, only made when Firebase is configured. */
    @Provides
    @Singleton
    fun aiModel(): AiModel = GeminiAiModel()
}
