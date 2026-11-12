#!/usr/bin/env node
/**
 * UniTax Pro — Vanilla Automated E2E Test Runner
 * Architecture: 100% Vanilla Node.js (Zero npm packages, zero external bundlers)
 * Conforms to ORIGINAL_REQUEST.md & PROJECT.md
 */

const path = require('node:path');
const { suite, COLORS } = require('./harness');

function printBanner() {
    console.log(`${COLORS.bright}${COLORS.blue}`);
    console.log(`╔══════════════════════════════════════════════════════════════════════════╗`);
    console.log(`║                   UNITAX PRO ENTERPRISE ERP TEST SUITE                   ║`);
    console.log(`║           Opaque-Box Requirement-Driven E2E Engine (Tiers 1–4)           ║`);
    console.log(`╚══════════════════════════════════════════════════════════════════════════╝${COLORS.reset}`);
    console.log(`${COLORS.gray}Environment: Node.js ${process.version} | Vanilla Runtime | Zero Dependencies${COLORS.reset}\n`);
}

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        tierFilter: null,
        featureFilter: null,
        patternFilter: null,
        verbose: false
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: node tests/test_runner.js [options]

Options:
  --tier=<1|2|3|4>        Run only tests belonging to specified tier
  --feature=<1..21>       Run only tests covering specified feature number
  --pattern=<regex>       Filter tests by title or suite name regex
  --verbose, -v           Show detailed error traces on failures
  --help, -h              Display this help message
            `);
            process.exit(0);
        } else if (arg.startsWith('--tier=')) {
            options.tierFilter = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--feature=')) {
            options.featureFilter = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--pattern=')) {
            options.patternFilter = arg.split('=')[1];
        } else if (arg === '--verbose' || arg === '-v') {
            options.verbose = true;
        }
    }

    return options;
}

async function main() {
    printBanner();
    const options = parseArgs();

    console.log(`${COLORS.dim}Loading test suites across Tiers 1-4...${COLORS.reset}`);

    // Load Tier test suites
    require('./tier1_features.test');
    require('./tier2_boundaries.test');
    require('./tier3_combinations.test');
    require('./tier4_realworld.test');

    console.log(`${COLORS.dim}Registered ${suite.tests.length} tests in suite.${COLORS.reset}`);
    if (options.tierFilter) console.log(`${COLORS.yellow}Filtering by Tier: ${options.tierFilter}${COLORS.reset}`);
    if (options.featureFilter) console.log(`${COLORS.yellow}Filtering by Feature: F${options.featureFilter}${COLORS.reset}`);
    if (options.patternFilter) console.log(`${COLORS.yellow}Filtering by Pattern: "${options.patternFilter}"${COLORS.reset}`);

    const results = await suite.run(options);

    console.log(`\n${COLORS.bright}${COLORS.white}========================================================================${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.white}TEST EXECUTION SUMMARY${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.white}========================================================================${COLORS.reset}`);
    console.log(`  Total Tests Executed : ${COLORS.bright}${results.total}${COLORS.reset}`);
    console.log(`  Passed               : ${COLORS.green}${COLORS.bright}${results.passed}${COLORS.reset}`);
    console.log(`  Failed               : ${results.failed > 0 ? COLORS.red : COLORS.green}${COLORS.bright}${results.failed}${COLORS.reset}`);
    console.log(`  Duration             : ${results.duration}s`);

    const passRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
    console.log(`  Pass Rate            : ${passRate === '100.0' ? COLORS.green : COLORS.yellow}${passRate}%${COLORS.reset}`);

    if (results.failed > 0) {
        console.log(`\n${COLORS.bright}${COLORS.red}FAILURE DIAGNOSIS & REMEDIATION REPORT:${COLORS.reset}`);
        console.log(`${COLORS.red}------------------------------------------------------------------------${COLORS.reset}`);
        results.errors.forEach((f, idx) => {
            const featStr = f.feature ? ` [F${f.feature.num}: ${f.feature.name}]` : '';
            console.log(`${COLORS.bright}${idx + 1}. [Tier ${f.tier}]${featStr} ${f.suite} > ${f.test}${COLORS.reset}`);
            console.log(`   ${COLORS.red}Reason: ${f.error.message}${COLORS.reset}`);
            if (options.verbose && f.error.stack) {
                console.log(`   ${COLORS.gray}${f.error.stack.split('\n').slice(1, 4).join('\n   ')}${COLORS.reset}`);
            }
        });
        console.log(`\n${COLORS.bright}${COLORS.yellow}Action Required: Remediation needed in implementation code to satisfy requirements.${COLORS.reset}\n`);
        process.exit(1);
    } else {
        console.log(`\n${COLORS.bright}${COLORS.green}✔ ALL TEST CRITERIA SATISFIED. ZERO REGRESSIONS DETECTED.${COLORS.reset}\n`);
        process.exit(0);
    }
}

main().catch(err => {
    console.error(`\n${COLORS.red}Fatal Runner Error: ${err.message}${COLORS.reset}`);
    console.error(err.stack);
    process.exit(1);
});
