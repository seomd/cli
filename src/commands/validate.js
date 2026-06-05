import chalk from 'chalk';
import { parseSeoMd } from '../utils/parser.js';
import { validateSeoMd } from '../validators/seomd.js';

export async function validateCommand() {
    console.log('');
    console.log(chalk.bold('Validating SEO.md...') + '\n');

    try {
        const { data } = await parseSeoMd(process.cwd());
        const { errors, warnings } = validateSeoMd(data);

        if (errors.length === 0 && warnings.length === 0) {
            console.log(chalk.green('  ✓ ') + chalk.bold('SEO.md is fully compliant with spec v1.0!'));
            console.log('');
            process.exit(0);
        }

        // Print errors
        if (errors.length > 0) {
            console.log(chalk.red.bold(`  Errors (${errors.length}):`));
            errors.forEach(err => {
                const pathStr = err.path ? chalk.dim(`[${err.path}]`) : '';
                console.log(`    ${chalk.red('✗')} ${err.message} ${pathStr}`);
            });
            console.log('');
        }

        // Print warnings
        if (warnings.length > 0) {
            console.log(chalk.yellow.bold(`  Warnings (${warnings.length}):`));
            warnings.forEach(warn => {
                const pathStr = warn.path ? chalk.dim(`[${warn.path}]`) : '';
                console.log(`    ${chalk.yellow('⚠')} ${warn.message} ${pathStr}`);
            });
            console.log('');
        }

        // Final status report
        if (errors.length > 0) {
            console.log(chalk.red.bold(`✗ Validation failed: ${errors.length} error(s) and ${warnings.length} warning(s) found.`));
            console.log(chalk.dim('Please fix the errors to make your SEO.md valid.'));
            console.log('');
            process.exit(1);
        } else {
            console.log(chalk.yellow.bold(`✓ Validation passed with ${warnings.length} warning(s).`));
            console.log(chalk.dim('Warnings are optional recommendations and do not block compliance.'));
            console.log('');
            process.exit(0);
        }

    } catch (err) {
        console.log(chalk.red('✗ ') + chalk.bold('Validation process failed:'));
        console.log(`  ${chalk.dim(err.message)}`);
        console.log('');
        process.exit(1);
    }
}
