import { Platform, Dimensions, PixelRatio, AppState } from "react-native";

/**
 * Interface representing all timing checkpoints and milestones
 */
export interface HomeScreenPerfMilestones {
  appBootTime: number;
  authStartTime?: number;
  authEndTime?: number;
  splashStartTime?: number;
  splashEndTime?: number;
  homeMountTime: number;
  dashboardFetchStartTime?: number;
  dashboardApiDurationMs?: number;
  dashboardProcessingDurationMs?: number;
  dashboardSource?: "MEMORY_CACHE" | "STORAGE_CACHE" | "NETWORK_API";
  cardsResolvedTime?: number;
  homeFullyLoadedTime: number;
}

export interface HomeScreenPerfMetadata {
  user?: {
    userId: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    companyId?: string | null;
  };
  content?: {
    plansCount: number;
    resolvedCardsCount: number;
    totalModulesCount: number;
    completedModulesCount: number;
    progressPercentage: number;
    nudgeMessage?: string;
  };
  refreshCount?: number;
  isWarmNavigation?: boolean;
}

class HomePerformanceMeter {
  private appBootTime: number = Date.now();
  private authStartTime?: number;
  private authEndTime?: number;
  private splashStartTime?: number;
  private splashEndTime?: number;
  private homeMountTime: number = 0;
  private dashboardFetchStartTime?: number;
  private dashboardApiDurationMs?: number;
  private dashboardProcessingDurationMs?: number;
  private dashboardSource: "MEMORY_CACHE" | "STORAGE_CACHE" | "NETWORK_API" = "STORAGE_CACHE";
  private cardsResolvedTime?: number;
  
  private hasReportedColdStart: boolean = false;
  private mountCount: number = 0;
  private refreshCount: number = 0;
  private refreshStartTime: number = 0;

  constructor() {
    // Record true JS runtime initialization
    const g = globalThis as any;
    if (typeof g.__LUCID_APP_BOOT_TIME__ === "number") {
      this.appBootTime = g.__LUCID_APP_BOOT_TIME__;
    } else {
      g.__LUCID_APP_BOOT_TIME__ = this.appBootTime;
    }
  }

  /**
   * Called at very first moment of app / index load
   */
  public initBootTime(timestamp: number = Date.now()) {
    this.appBootTime = timestamp;
    (globalThis as any).__LUCID_APP_BOOT_TIME__ = timestamp;
  }

  /**
   * Called when AuthContext starts checking session / restoring cache
   */
  public markAuthStart() {
    this.authStartTime = Date.now();
  }

  /**
   * Called when AuthContext finishes restoring user / checking Firebase
   */
  public markAuthReady() {
    this.authEndTime = Date.now();
  }

  /**
   * Called when Splash screen becomes active
   */
  public markSplashStart() {
    this.splashStartTime = Date.now();
  }

  /**
   * Called when Splash screen animation and data readiness complete
   */
  public markSplashComplete() {
    this.splashEndTime = Date.now();
  }

  /**
   * Called when HomeScreen mounts
   */
  public markHomeScreenMount() {
    this.homeMountTime = Date.now();
    this.mountCount++;
  }

  /**
   * Called when dashboard summary fetch starts
   */
  public markDashboardFetchStart() {
    this.dashboardFetchStartTime = Date.now();
  }

  /**
   * Called when dashboard summary fetch finishes
   */
  public markDashboardFetchEnd(params: {
    apiDurationMs?: number;
    processingDurationMs?: number;
    source: "MEMORY_CACHE" | "STORAGE_CACHE" | "NETWORK_API";
  }) {
    this.dashboardApiDurationMs = params.apiDurationMs;
    this.dashboardProcessingDurationMs = params.processingDurationMs;
    this.dashboardSource = params.source;
    this.cardsResolvedTime = Date.now();
  }

  /**
   * Called when user initiates pull-to-refresh
   */
  public markRefreshStart() {
    this.refreshStartTime = Date.now();
    this.refreshCount++;
    console.log(
      `[PerfMeter] [REFRESH] HomeScreen refresh #${this.refreshCount} triggered at ${new Date().toISOString()}`
    );
  }

  /**
   * Called when pull-to-refresh completes
   */
  public markRefreshComplete(metadata: HomeScreenPerfMetadata) {
    const now = Date.now();
    const refreshDuration = this.refreshStartTime > 0 ? now - this.refreshStartTime : 0;
    
    console.log("\n" + "=".repeat(82));
    console.log("[PERF-METER] HOME SCREEN REFRESH COMPLETED");
    console.log("=".repeat(82));
    console.log(`* TOTAL REFRESH DURATION       : ${refreshDuration.toLocaleString()} ms`);
    if (this.dashboardApiDurationMs !== undefined) {
      console.log(`* NETWORK API LATENCY          : ${this.dashboardApiDurationMs.toLocaleString()} ms`);
    }
    if (this.dashboardProcessingDurationMs !== undefined) {
      console.log(`* DATA PROCESSING & RESOLVE    : ${this.dashboardProcessingDurationMs.toLocaleString()} ms`);
    }
    console.log(`* RESOLVED CARDS               : ${metadata.content?.resolvedCardsCount ?? 0}`);
    console.log(`* COMPLETED / PROGRESS         : ${metadata.content?.completedModulesCount ?? 0} modules (${metadata.content?.progressPercentage ?? 0}%)`);
    console.log(`* USER ID                      : ${metadata.user?.userId ?? "guest"}`);
    console.log(`* COMPLETED TIMESTAMP          : ${new Date(now).toISOString()}`);
    console.log("=".repeat(82) + "\n");
  }

  /**
   * Called when HomeScreen is fully rendered, populated with cards, and interactive
   */
  public markHomeScreenFullyLoaded(metadata: HomeScreenPerfMetadata) {
    const now = Date.now();
    const isColdStart = !this.hasReportedColdStart;
    this.hasReportedColdStart = true;

    // Durations calculation
    const totalColdStartTime = isColdStart ? now - this.appBootTime : 0;
    const screenLoadTime = this.homeMountTime > 0 ? now - this.homeMountTime : 0;

    const authDuration =
      this.authStartTime && this.authEndTime
        ? this.authEndTime - this.authStartTime
        : undefined;

    const splashDuration =
      this.splashStartTime && this.splashEndTime
        ? this.splashEndTime - this.splashStartTime
        : undefined;

    const jsInitToAuthStart =
      this.authStartTime ? this.authStartTime - this.appBootTime : undefined;

    // Device / Platform information
    const platformConstants = (Platform.constants || {}) as any;
    const deviceBrand =
      platformConstants.Brand ||
      platformConstants.brand ||
      platformConstants.Manufacturer ||
      "Generic";
    const deviceModel =
      platformConstants.Model ||
      platformConstants.model ||
      Platform.OS;
    const osVersion =
      platformConstants.Release ||
      platformConstants.release ||
      Platform.Version;

    const windowDim = Dimensions.get("window");
    const screenRes = `${Math.round(windowDim.width)}x${Math.round(windowDim.height)} @ ${PixelRatio.get().toFixed(1)}x`;

    // Construct the formatted breakdown
    const divider = "=".repeat(82);
    const subDivider = "-".repeat(82);

    console.log("\n" + divider);
    console.log(`[PERF-METER] HOME SCREEN FULLY LOADED ON DEVICE`);
    console.log(divider);

    if (isColdStart) {
      console.log(`* TOTAL TIME (APP LAUNCH -> FULLY LOADED) : ${totalColdStartTime.toLocaleString().padStart(6)} ms`);
    }
    console.log(`* SCREEN LOAD TIME (MOUNT -> FULLY LOADED) : ${screenLoadTime.toLocaleString().padStart(6)} ms`);
    console.log(`* LAUNCH CLASSIFICATION                    : ${isColdStart ? "COLD_START (First Boot)" : `WARM_START (Mount #${this.mountCount})`}`);
    console.log(`* DATA SOURCE CACHE TIER                   : ${this.dashboardSource}`);

    console.log("\n" + subDivider);
    console.log(`PHASE BREAKDOWN & LATENCY TIMELINE:`);
    console.log(subDivider);

    let step = 1;
    if (isColdStart && jsInitToAuthStart !== undefined) {
      const pct = totalColdStartTime > 0 ? ((jsInitToAuthStart / totalColdStartTime) * 100).toFixed(1) : "0.0";
      console.log(`   [${step++}] JS Engine & Module Initialization : ${jsInitToAuthStart.toLocaleString().padStart(5)} ms (${pct.padStart(5)}%)`);
    }

    if (isColdStart && authDuration !== undefined) {
      const pct = totalColdStartTime > 0 ? ((authDuration / totalColdStartTime) * 100).toFixed(1) : "0.0";
      console.log(`   [${step++}] Auth & Session Verification       : ${authDuration.toLocaleString().padStart(5)} ms (${pct.padStart(5)}%)`);
    }

    if (isColdStart && splashDuration !== undefined) {
      const pct = totalColdStartTime > 0 ? ((splashDuration / totalColdStartTime) * 100).toFixed(1) : "0.0";
      console.log(`   [${step++}] Animated Splash & Data Preload    : ${splashDuration.toLocaleString().padStart(5)} ms (${pct.padStart(5)}%)`);
    }

    const screenPct = isColdStart && totalColdStartTime > 0
      ? ((screenLoadTime / totalColdStartTime) * 100).toFixed(1)
      : "100.0";
    console.log(`   [${step++}] HomeScreen Mount to Fully Rendered : ${screenLoadTime.toLocaleString().padStart(5)} ms (${screenPct.padStart(5)}%)`);

    if (this.dashboardApiDurationMs !== undefined) {
      console.log(`       |-- Dashboard Backend Network API   : ${this.dashboardApiDurationMs.toLocaleString().padStart(5)} ms`);
    }
    if (this.dashboardProcessingDurationMs !== undefined) {
      console.log(`       |-- Modules & Cards Resolution      : ${this.dashboardProcessingDurationMs.toLocaleString().padStart(5)} ms`);
    }
    const mountCommitTime = Math.max(0, screenLoadTime - (this.dashboardProcessingDurationMs ?? 0));
    console.log(`       \\-- React UI Commit & Animation Fade: ${mountCommitTime.toLocaleString().padStart(5)} ms`);

    console.log("\n" + subDivider);
    console.log(`DEVICE & HARDWARE METADATA:`);
    console.log(subDivider);
    console.log(`   * Platform OS    : ${Platform.OS.toUpperCase()} (Version ${osVersion}, API ${Platform.Version})`);
    console.log(`   * Device Model   : ${deviceBrand} ${deviceModel}`);
    console.log(`   * Screen Display : ${screenRes}`);
    console.log(`   * App State      : ${AppState.currentState}`);
    console.log(`   * JS Environment : ${__DEV__ ? "Development (Metro Bundler)" : "Production Bundle"}`);

    console.log("\n" + subDivider);
    console.log(`USER & TENANT METADATA:`);
    console.log(subDivider);
    console.log(`   * User ID        : ${metadata.user?.userId ?? "N/A"}`);
    console.log(`   * Name           : ${metadata.user?.name ?? "N/A"}`);
    console.log(`   * Email          : ${metadata.user?.email ?? "N/A"}`);
    console.log(`   * Phone          : ${metadata.user?.phone ?? "N/A"}`);
    console.log(`   * Company ID     : ${metadata.user?.companyId ?? "N/A"}`);

    console.log("\n" + subDivider);
    console.log(`DASHBOARD CONTENT & PERFORMANCE METRICS:`);
    console.log(subDivider);
    console.log(`   * Training Plans : ${metadata.content?.plansCount ?? 0} active plans`);
    console.log(`   * Resolved Cards : ${metadata.content?.resolvedCardsCount ?? 0} cards displayed`);
    console.log(`   * Total Modules  : ${metadata.content?.totalModulesCount ?? 0}`);
    console.log(`   * Completed      : ${metadata.content?.completedModulesCount ?? 0} / ${metadata.content?.totalModulesCount ?? 0}`);
    console.log(`   * Overall Prog.  : ${metadata.content?.progressPercentage ?? 0}%`);
    if (metadata.content?.nudgeMessage) {
      console.log(`   * Nudge Status   : "${metadata.content.nudgeMessage}"`);
    }

    console.log("\n" + subDivider);
    console.log(`SYSTEM TIMESTAMPS:`);
    console.log(subDivider);
    console.log(`   * App Boot Start : ${new Date(this.appBootTime).toISOString()} (${this.appBootTime})`);
    if (this.homeMountTime > 0) {
      console.log(`   * Home Mount     : ${new Date(this.homeMountTime).toISOString()} (${this.homeMountTime})`);
    }
    console.log(`   * Fully Loaded   : ${new Date(now).toISOString()} (${now})`);
    console.log(divider + "\n");

    // Also output a compact JSON log for tooling / regex extraction
    console.log(
      `[PerfMeter:JSON] ` +
        JSON.stringify({
          eventType: "HOME_SCREEN_FULLY_LOADED",
          launchType: isColdStart ? "COLD_START" : "WARM_START",
          totalColdStartTimeMs: totalColdStartTime,
          screenLoadTimeMs: screenLoadTime,
          authDurationMs: authDuration,
          splashDurationMs: splashDuration,
          dashboardApiLatencyMs: this.dashboardApiDurationMs,
          dashboardProcessingDurationMs: this.dashboardProcessingDurationMs,
          dataSource: this.dashboardSource,
          userId: metadata.user?.userId,
          companyId: metadata.user?.companyId,
          plansCount: metadata.content?.plansCount,
          resolvedCardsCount: metadata.content?.resolvedCardsCount,
          completedCount: metadata.content?.completedModulesCount,
          progressPercentage: metadata.content?.progressPercentage,
          device: {
            platform: Platform.OS,
            osVersion,
            brand: deviceBrand,
            model: deviceModel,
            screen: screenRes,
          },
          timestamp: new Date(now).toISOString(),
          epochMs: now,
        })
    );
  }
}

export const homePerfMeter = new HomePerformanceMeter();
