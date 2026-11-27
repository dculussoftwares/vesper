package com.dculus.vesper.core.sync

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
internal object AiModule {
    @Provides
    @Singleton
    fun describer(builder: AiBlockBuilder): BlockDescriber = builder

    @Provides
    @Singleton
    fun reporter(reporter: FirebaseAiReporter): AiReporter = reporter
}
