import { testStage1 } from "./tests/stage1-auth";
import { testStage2 } from "./tests/stage2-public-map";
import { testStage3 } from "./tests/stage3-institution-portal";
import { testStage4 } from "./tests/stage4-polygon-editor";
import { testStage5 } from "./tests/stage5-child-points";
import { testStage6and7 } from "./tests/stage6-7-admin-and-rejection";
import { testStage8 } from "./tests/stage8-lifecycle-crud";
import { testStage9 } from "./tests/stage9-security";
import { testStage10 } from "./tests/stage10-ui-ux-ssr";

async function runMasterTestSuite() {
  console.log("======================================================================");
  console.log("   SIS-LPI NEXT: MASTER TEST SUITE EXECUTION (ALL 10 STAGES)          ");
  console.log("======================================================================");
  const startTime = Date.now();

  const allStages = [
    testStage1,
    testStage2,
    testStage3,
    testStage4,
    testStage5,
    testStage6and7,
    testStage8,
    testStage9,
    testStage10,
  ];

  const summary: { stage: string; passed: boolean; results: any[] }[] = [];

  for (const stageFn of allStages) {
    try {
      const res = await stageFn();
      summary.push(res);
    } catch (err: any) {
      console.error("Critical error executing stage:", err);
      summary.push({ stage: stageFn.name, passed: false, results: [{ id: "ERR", name: "Crash", status: "FAIL", details: err.message }] });
    }
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n======================================================================");
  console.log("                  RINGKASAN AKHIR HASIL PENGUJIAN                     ");
  console.log("======================================================================");

  let totalTests = 0;
  let totalPass = 0;
  let totalFail = 0;

  for (const s of summary) {
    const stagePassCount = s.results.filter((r) => r.status === "PASS").length;
    const stageFailCount = s.results.filter((r) => r.status === "FAIL").length;
    totalTests += s.results.length;
    totalPass += stagePassCount;
    totalFail += stageFailCount;

    const icon = s.passed ? "✅ [PASS]" : "❌ [FAIL]";
    console.log(`${icon.padEnd(10)} ${s.stage.padEnd(18)}: ${stagePassCount}/${s.results.length} test cases lolos`);
  }

  console.log("----------------------------------------------------------------------");
  console.log(`Total Test Cases : ${totalTests}`);
  console.log(`Passed           : ${totalPass} (${((totalPass / totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed           : ${totalFail}`);
  console.log(`Total Waktu Uji  : ${elapsedSec} detik`);
  console.log("======================================================================\n");

  if (totalFail > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterTestSuite();
