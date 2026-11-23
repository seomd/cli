import chalk from 'chalk';
import { parseSeoMd } from '../utils/parser.js';
import { validateSeoMd } from '../validators/seomd.js';

export async function validateCommand(options = {}) {
    try {
        const { format, data, body } = await parseSeoMd(process.cwd());
        const { errors, warnings, specVersion } = validateSeoMd(data, { format, body });
        const failed = errors.length > 0 || (Boolean(options.strict) && warnings.length > 0);

        if (options.json) {
            console.log(
                JSON.stringify(
                    {
                        valid: !failed,
                        format,
                        spec: specVersion,
                        errors,
                        warnings,
                    },
                    null,
                    2
                )
            );
            process.exitCode = failed ? 1 : 0;
            return;
        }

        console.log('');
        console.log(chalk.bold('Validating SEO.md...') + chalk.dim(` (format: ${format}, spec v${specVersion})\n`));

        if (errors.length === 0 && warnings.length === 0) {
            console.log(chalk.green('  ✓ ') + chalk.bold(`SEO.md is fully compliant with spec v${specVersion}!`));
            console.log('');
            process.exitCode = 0;
            return;
        }

        if (errors.length > 0) {
            console.log(chalk.red.bold(`  Errors (${errors.length}):`));
            errors.forEach((err) => {
                const pathStr = err.path ? chalk.dim(`[${err.path}]`) : '';
                console.log(`    ${chalk.red('✗')} ${err.message} ${pathStr}`);
            });
            console.log('');
        }

        if (warnings.length > 0) {
            console.log(chalk.yellow.bold(`  Warnings (${warnings.length}):`));
            warnings.forEach((warn) => {
                const pathStr = warn.path ? chalk.dim(`[${warn.path}]`) : '';
                console.log(`    ${chalk.yellow('⚠')} ${warn.message} ${pathStr}`);
            });
            console.log('');
        }

        if (failed) {
            console.log(
                chalk.red.bold(
                    `✗ Validation failed: ${errors.length} error(s) and ${warnings.length} warning(s) found.`
                )
            );
            console.log(
                chalk.dim(
                    options.strict && errors.length === 0
                        ? 'Strict mode is enabled: resolve warnings to pass.'
                        : 'Please fix the errors to make your SEO.md valid.'
                )
            );
            console.log('');
            process.exitCode = 1;
            return;
        }

        console.log(chalk.yellow.bold(`✓ Validation passed with ${warnings.length} warning(s).`));
        console.log(chalk.dim('Warnings are optional recommendations and do not block compliance.'));
        console.log('');
        process.exitCode = 0;
    } catch (err) {
        if (options.json) {
            console.log(JSON.stringify({ valid: false, errors: [{ path: '', message: err.message }], warnings: [] }, null, 2));
        } else {
            console.log(chalk.red('✗ ') + chalk.bold('Validation process failed:'));
            console.log(`  ${chalk.dim(err.message)}`);
            console.log('');
        }
        process.exitCode = 1;
    }
}
