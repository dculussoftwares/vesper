package com.dculus.vesper.feature.account

import app.cash.turbine.test
import com.dculus.vesper.core.blocking.engine.EngineHealthMonitor
import com.dculus.vesper.core.blocking.permissions.PermissionsRepository
import com.dculus.vesper.core.model.Permissions
import com.dculus.vesper.core.sync.AuthFailure
import com.dculus.vesper.core.sync.AuthResult
import com.dculus.vesper.core.sync.AuthUser
import com.dculus.vesper.core.sync.DeleteAccountFailure
import com.dculus.vesper.core.sync.DeleteAccountResult
import com.dculus.vesper.core.sync.FakeAccountDeletionRepository
import com.dculus.vesper.core.sync.FakeAuthRepository
import com.dculus.vesper.core.testing.FakeSettingsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class AccountViewModelTest {
    private class FakePermissions : PermissionsRepository {
        val state =
            MutableStateFlow(Permissions(usage = false, accessibility = false, overlay = false, notifications = false))

        override fun observe(): Flow<Permissions> = state

        override fun current(): Permissions = state.value

        override fun needsRestrictedSettingsGuidance(): Boolean = false
    }

    @Before
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun anAdultBirthDateTurnsAiOn() = aiAnswer(YearMonth.of(1990, 5), expected = true)

    @Test
    fun anUnder18BirthDateKeepsAiOffAndCannotBeRetried() = aiAnswer(YearMonth.of(2015, 5), expected = false)

    private fun aiAnswer(
        birth: YearMonth,
        expected: Boolean,
    ) = runTest {
        val auth = FakeAuthRepository()
        val settings = FakeSettingsRepository()
        val viewModel =
            AccountViewModel(
                auth,
                FakePermissions(),
                EngineHealthMonitor(Clock.systemUTC()),
                FakeAccountDeletionRepository(auth) {},
                settings,
                Clock.fixed(Instant.parse("2026-11-15T00:00:00Z"), ZoneOffset.UTC),
            )
        viewModel.answerAiAge(birth)
        viewModel.answerAiAge(YearMonth.of(1970, 1))
        val saved = settings.settings.first()
        assertTrue(saved.aiAgeAnswered)
        assertEquals(expected, saved.aiEnabled)
    }

    @Test
    fun birthMonthIsOnlyAcceptedWhenComplete() {
        val now = YearMonth.of(2026, 11)
        assertEquals(YearMonth.of(2000, 3), birthMonthOrNull("3", "2000", now))
        assertNull(birthMonthOrNull("13", "2000", now))
        assertNull(birthMonthOrNull("3", "20", now))
        assertNull(birthMonthOrNull("12", "2026", now))
        assertNull(birthMonthOrNull("", "2000", now))
    }

    @Test
    fun skippedSignInHasNoUser() =
        runTest {
            val auth = FakeAuthRepository()
            val viewModel =
                AccountViewModel(
                    auth,
                    FakePermissions(),
                    EngineHealthMonitor(Clock.systemUTC()),
                    FakeAccountDeletionRepository(auth) {},
                    FakeSettingsRepository(),
                    Clock.systemUTC(),
                )
            viewModel.state.test {
                var item = awaitItem()
                if (!item.authLoaded) item = awaitItem()
                assertTrue(item.authLoaded)
                assertNull(item.user)
            }
        }

    @Test
    fun warningGlowFollowsTheSettingAndTheToggleWritesIt() =
        runTest {
            val auth = FakeAuthRepository()
            val settings = FakeSettingsRepository()
            val viewModel =
                AccountViewModel(
                    auth,
                    FakePermissions(),
                    EngineHealthMonitor(Clock.systemUTC()),
                    FakeAccountDeletionRepository(auth) {},
                    settings,
                    Clock.systemUTC(),
                )
            viewModel.state.test {
                var item = awaitItem()
                if (!item.authLoaded) item = awaitItem()
                assertTrue(item.warningGlow)
                viewModel.setWarningGlow(false)
                assertEquals(false, awaitItem().warningGlow)
                assertEquals(false, settings.settings.first().usageWarningGlow)
                assertTrue(viewModel.state.value.appTimer)
                viewModel.setAppTimer(false)
                val next = awaitItem()
                assertEquals(false, next.appTimer)
                assertEquals(false, next.warningGlow)
                assertEquals(false, settings.settings.first().appStartTimer)
            }
        }

    @Test
    fun permissionsAndEngineFollowTheirSourcesAndSignOutClearsTheUser() =
        runTest {
            val auth = FakeAuthRepository()
            val permissions = FakePermissions()
            val engine = EngineHealthMonitor(Clock.systemUTC())
            auth.signInWithEmail("alex@example.com", "secret1")
            val viewModel =
                AccountViewModel(
                    auth,
                    permissions,
                    engine,
                    FakeAccountDeletionRepository(auth) {},
                    FakeSettingsRepository(),
                    Clock.systemUTC(),
                )
            viewModel.state.test {
                var item = awaitItem()
                if (!item.authLoaded) item = awaitItem()
                assertNotNull(item.user)
                permissions.state.value = permissions.state.value.copy(usage = true)
                item = awaitItem()
                assertTrue(item.permissions.usage)
                engine.onServiceConnected()
                assertTrue(awaitItem().engine.serviceBound)
                viewModel.signOut()
                // The spinner state may be emitted first; wait for the signed-out state.
                var after = awaitItem()
                while (after.user != null) after = awaitItem()
                assertNull(after.user)
            }
        }

    @Test
    fun nameFallsBackToTheEmailLocalPart() {
        assertEquals("Alex", AuthUser("u", "a@b.co", "Alex").shownName())
        assertEquals("alex", AuthUser("u", "alex@b.co", null).shownName())
        assertEquals("A", AuthUser("u", "alex@b.co", null).initial())
        assertEquals("?", AuthUser("u", null, null).initial())
    }

    private class DeleteFixture {
        val auth = FakeAuthRepository()
        val deletion = FakeAccountDeletionRepository(auth) {}
        val viewModel =
            AccountViewModel(
                auth,
                FakePermissions(),
                EngineHealthMonitor(Clock.systemUTC()),
                deletion,
                FakeSettingsRepository(),
                Clock.systemUTC(),
            )
    }

    @Test
    fun deleteWithAFreshSignInDeletesAndSignsOut() =
        runTest {
            val f = DeleteFixture()
            f.auth.signInWithEmail("alex@example.com", "secret1")
            f.viewModel.startDelete()
            assertEquals(DeleteStep.Confirm, f.viewModel.delete.value.step)
            f.viewModel.confirmDelete()
            assertTrue(f.viewModel.delete.value.deleted)
            assertEquals(1, f.deletion.deleteCalls)
            f.viewModel.deleteHandled()
            assertEquals(DeleteUiState(), f.viewModel.delete.value)
        }

    @Test
    fun cancelClosesTheSheetWithoutDeleting() =
        runTest {
            val f = DeleteFixture()
            f.viewModel.startDelete()
            f.viewModel.cancelDelete()
            assertEquals(DeleteStep.Hidden, f.viewModel.delete.value.step)
            assertEquals(0, f.deletion.deleteCalls)
        }

    @Test
    fun aStaleSignInAsksToReauthenticateBeforeDeleting() =
        runTest {
            val f = DeleteFixture()
            f.deletion.staleSignIn = true
            f.viewModel.startDelete()
            f.viewModel.confirmDelete()
            assertEquals(DeleteStep.Reauth, f.viewModel.delete.value.step)
            assertEquals(0, f.deletion.deleteCalls)

            f.viewModel.reauthenticateWithPassword("secret1")
            assertTrue(f.viewModel.delete.value.deleted)
            assertEquals(1, f.deletion.deleteCalls)
        }

    @Test
    fun aServerRefusalForAStaleTokenAlsoAsksToReauthenticate() =
        runTest {
            val f = DeleteFixture()
            f.deletion.deleteResult = DeleteAccountResult.NeedsReauth
            f.viewModel.startDelete()
            f.viewModel.confirmDelete()
            assertEquals(DeleteStep.Reauth, f.viewModel.delete.value.step)
        }

    @Test
    fun aWrongPasswordShowsAnErrorAndDeletesNothing() =
        runTest {
            val f = DeleteFixture()
            f.deletion.staleSignIn = true
            f.deletion.reauthResult = AuthResult.Failure(AuthFailure.InvalidCredentials)
            f.viewModel.startDelete()
            f.viewModel.confirmDelete()
            f.viewModel.reauthenticateWithPassword("nope")
            val state = f.viewModel.delete.value
            assertEquals(DeleteError.WrongPassword, state.error)
            assertEquals(DeleteStep.Reauth, state.step)
            assertEquals(false, state.working)
            assertEquals(0, f.deletion.deleteCalls)
        }

    @Test
    fun aFailedDeleteKeepsTheSheetOpenWithAnError() =
        runTest {
            val f = DeleteFixture()
            f.deletion.deleteResult = DeleteAccountResult.Failure(DeleteAccountFailure.Network)
            f.viewModel.startDelete()
            f.viewModel.confirmDelete()
            val state = f.viewModel.delete.value
            assertEquals(DeleteError.Network, state.error)
            assertEquals(DeleteStep.Confirm, state.step)
            assertEquals(false, state.working)
            assertEquals(false, state.deleted)
        }
}
