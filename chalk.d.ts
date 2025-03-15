/*
    Typescript doesn't seem to recognize the functions of the chalk_deno module, so some are specified here to avoid type warnings.
*/

declare module "https://deno.land/x/chalk_deno@v4.1.1-deno/source/index.js" {
    export function red(text: string): string;
    export function green(text: string): string;
    export function blue(text: string): string;
    export function gray(text: string): string;
}
