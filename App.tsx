// Polyfill the WHATWG URL API before anything loads supabase-js: React Native's
// built-in URL is incomplete and gotrue/postgrest construct URL objects.
import "react-native-url-polyfill/auto";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { setActiveNightMode, styles, Tab } from "./src/theme";
import { Icon, NavButton } from "./src/components/common";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { Onboarding } from "./src/components/Onboarding";
import { StoreProvider, useStore } from "./src/state/store";
import { SettingsMenu } from "./src/components/SettingsMenu";
import { CeremonyOverlay } from "./src/components/CeremonyOverlay";
import { SystemScreen } from "./src/screens/SystemScreen";
import { CheckinScreen } from "./src/screens/CheckinScreen";
import { QuestScreen } from "./src/screens/QuestScreen";
import { JournalScreen } from "./src/screens/JournalScreen";
import { SheetScreen } from "./src/screens/SheetScreen";
import { WorldScreen } from "./src/screens/WorldScreen";
import { CommunityScreen } from "./src/screens/CommunityScreen";

export default function App() {
  return (
    <StoreProvider>
      <Console />
    </StoreProvider>
  );
}

function Console() {
  const { state, dispatch, loaded } = useStore();
  const [tab, setTab] = React.useState<Tab>("system");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [drawerScreen, setDrawerScreen] = React.useState<"community" | null>(null);
  const nightMode = Boolean(state.profile.preferences.nightMode);
  setActiveNightMode(nightMode);
  const screenTitles: Record<Tab, { title: string; eyebrow: string }> = {
    system: { title: "System", eyebrow: "Forge System OS" },
    checkin: { title: "Check-in", eyebrow: "Forge System OS" },
    quest: { title: "Quest Board", eyebrow: "Forge System OS" },
    journal: { title: "Journal", eyebrow: "Forge System OS" },
    sheet: { title: "Character Sheet", eyebrow: "Forge System OS" },
    world: { title: "World Map", eyebrow: "Forge System OS" }
  };
  const currentScreen = drawerScreen === "community"
    ? { title: "Community", eyebrow: "Forge System OS" }
    : screenTitles[tab];
  function openTab(next: Tab) {
    setDrawerScreen(null);
    setTab(next);
  }

  // Hydration gate: never render interactive UI over default state. Without
  // this, a check-in or onboarding completed in the first moments is wiped
  // when the saved state arrives and REPLACEs it.
  if (!loaded) {
    return (
      <SafeAreaProvider>
        <StatusBar style={nightMode ? "light" : "dark"} />
        <SafeAreaView style={[styles.shell, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={styles.eyebrow}>Forge System OS</Text>
          <Text style={styles.muted}>Waking the System…</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!state.hasOnboarded) {
    return (
      <SafeAreaProvider>
        <StatusBar style={nightMode ? "light" : "dark"} />
        <Onboarding onComplete={(goal) => void dispatch({ type: "COMPLETE_ONBOARDING", goal })} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.shell}>
        <StatusBar style={nightMode ? "light" : "dark"} />
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              onPress={() => setMenuOpen(true)}
              style={({ pressed }) => [styles.themeToggle, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Open settings menu"
            >
              <Icon name="menu" size={24} color={nightMode ? "#e0fbff" : "#075985"} />
            </Pressable>
            <View>
              <Text style={styles.eyebrow}>{currentScreen.eyebrow}</Text>
              <Text style={styles.title}>{currentScreen.title}</Text>
            </View>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>LV {state.progression.level}</Text>
          </View>
        </View>

        <ErrorBoundary onReset={() => void dispatch({ type: "RESET" })}>
          <ScrollView style={styles.content} contentContainerStyle={styles.contentPad}>
            {drawerScreen === "community" ? (
              <CommunityScreen />
            ) : (
              <>
                {tab === "system" && <SystemScreen />}
                {tab === "checkin" && <CheckinScreen />}
                {tab === "quest" && <QuestScreen />}
                {tab === "journal" && <JournalScreen />}
                {tab === "sheet" && <SheetScreen />}
                {tab === "world" && <WorldScreen />}
              </>
            )}
          </ScrollView>
        </ErrorBoundary>

        <View style={styles.nav}>
          <NavButton tab="system" current={tab} icon="terminal" label="System" setTab={openTab} />
          <NavButton tab="checkin" current={tab} icon="pulse" label="Check-in" setTab={openTab} />
          <NavButton tab="quest" current={tab} icon="flag" label="Quest" setTab={openTab} />
          <NavButton tab="journal" current={tab} icon="book" label="Journal" setTab={openTab} />
          <NavButton tab="sheet" current={tab} icon="person" label="Sheet" setTab={openTab} />
          <NavButton tab="world" current={tab} icon="map" label="World" setTab={openTab} />
        </View>

        <SettingsMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          onOpenCommunity={() => {
            setDrawerScreen("community");
            setMenuOpen(false);
          }}
        />
        {state.pendingCeremony ? <CeremonyOverlay event={state.pendingCeremony} /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
