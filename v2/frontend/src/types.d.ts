declare module "remount/es5";

declare module "country-telephone-data" {
    type Country = {
        name: string;
        dialCode: string;
        format: string;
        iso2: string;
    };
    declare const allCountries: Country[];
}
