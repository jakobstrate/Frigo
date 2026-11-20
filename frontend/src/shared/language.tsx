import { useLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from 'react-native';

export type AppLanguage = 'da' | 'en';

const languageStorageKey = 'frigo-app-language';

const englishTranslations: Record<string, string> = {
  'Produkter': 'Products',
  'Favoritter': 'Favorites',
  'Historik': 'History',
  'Indstillinger': 'Settings',
  'Kurv': 'Cart',
  'Se produkter': 'Browse products',
  'I alt': 'Total',
  'Registreret': 'Registered',
  'Færdig': 'Done',
  'Se historik': 'View history',
  'Ny adgangskode': 'New password',
  'Nuværende adgangskode': 'Current password',
  'Gentag adgangskode': 'Repeat password',
  'Mindst 8 tegn': 'At least 8 characters',
  'Store og små bogstaver': 'Uppercase and lowercase letters',
  'Mindst ét tal': 'At least one number',
  'Adgangskoderne er ikke ens': 'Passwords do not match',
  'Adgangskoderne er ikke ens.': 'Passwords do not match.',
  'Gem adgangskode': 'Save password',
  'Registreringer': 'Purchases',
  'Der er ingen registreringer i denne periode.': 'There are no purchases in this period.',
  'Ingen favoritter endnu': 'No favorites yet',
  'Tryk på hjertet ved et produkt for at gemme det her.': 'Tap the heart on a product to save it here.',
  'Prøv en anden søgning eller kategori.': 'Try another search or category.',
  'Ingen produkter fundet': 'No products found',
  'Periode': 'Period',
  'Skift': 'Change',
  'I alt i perioden': 'Period total',
  'Varer': 'Items',
  'Se registreringer': 'View registrations',
  'Din historik': 'Your history',
  'Profilbillede': 'Profile photo',
  'Gemmer billede...': 'Saving photo...',
  'Tryk for at ændre': 'Tap to change',
  'Tryk for at tilføje': 'Tap to add',
  'Navn': 'Name',
  'E-mail': 'Email',
  'Adgangskode': 'Password',
  'Skift adgangskode': 'Change password',
  'Virksomhed': 'Company',
  'Afdeling': 'Department',
  'Biometrisk login': 'Biometric sign-in',
  'Til. Bruges næste gang du logger ind.': 'On. Used next time you sign in.',
  'Fra. Brug adgangskode til login.': 'Off. Use your password to sign in.',
  'Log ud': 'Sign out',
  'Gå til kurv': 'Go to cart',
  'Antal': 'Quantity',
  'Slet din profil?': 'Delete your account?',
  'Fortryd': 'Cancel',
  'Vælg periode': 'Choose period',
  'Luk': 'Close',
  'Luk periodevælger': 'Close date range picker',
  'Sidste 7 dage': 'Last 7 days',
  'Standard': 'Default',
  'I år': 'This year',
  'Fra': 'From',
  'Til': 'To',
  'Vælg startdato': 'Choose a start date',
  'Vælg slutdato': 'Choose an end date',
  'Vis periode': 'Show period',
  'Sprog': 'Language',
  'Vælg appens sprog': 'Choose the app language',
  'Dansk': 'Danish',
  'Søg i produkter': 'Search products',
  'Ryd søgning': 'Clear search',
  'Alle': 'All',
  'Tilføj profilbillede': 'Add profile photo',
  'Skift profilbillede': 'Change profile photo',
  'Giv Frigo adgang til dine billeder for at vælge et profilbillede.': 'Allow Frigo to access your photos to choose a profile photo.',
  'Vælg et profilbillede i JPG-, PNG- eller WEBP-format.': 'Choose a JPG, PNG, or WEBP profile photo.',
  'Profilbilledet må højst fylde 5 MB.': 'The profile photo must be 5 MB or smaller.',
  'Billedet kunne ikke læses. Vælg et andet billede.': 'The image could not be read. Choose another image.',
  'Profilbilledet er opdateret.': 'Profile photo updated.',
  'Profilbilledet er gemt, men kunne ikke vises lige nu.': 'Profile photo saved, but could not be displayed right now.',
  'Profilbilledet kunne ikke gemmes. Prøv igen.': 'Could not save profile photo. Try again.',
  'Kunne ikke indlæse profilbilledet.': 'Could not load profile photo.',
  'Profilbilledet kunne ikke gemmes: ': 'Could not save profile photo: ',
  'Kurven er tom': 'Your cart is empty',
  'Vælg et produkt for at lægge det i kurven.': 'Choose a product to add it to your cart.',
  'Produktbillederne kunne ikke indlæses. Produktikoner vises i stedet.': 'Product images could not be loaded. Product icons are shown instead.',
  'Live opdateringer kunne ikke forbindes. Kataloget tjekkes automatisk med jævne mellemrum.': 'Live updates could not connect. The catalog will refresh periodically.',
  'Nogle kategori-, profil- eller historikoplysninger kunne ikke indlæses. Produkterne er tilgængelige.': 'Some category, profile, or history details could not be loaded. Products are still available.',
  'App-data kunne ikke indlæses. Prøv igen.': 'App data could not be loaded. Try again.',
  'Produkterne er indlæst, men live opdateringer kunne ikke forbindes.': 'Products loaded, but live updates could not connect.',
  'Produkter, der ikke længere er aktive, er fjernet fra kurven.': 'Products that are no longer active were removed from the cart.',
  'Favoritten kunne ikke gemmes. Prøv igen.': 'Could not save favorite. Try again.',
  'Din profil kunne ikke indlæses. Log ind igen.': 'Could not load your profile. Sign in again.',
  'Registreringen kunne ikke gennemføres. Prøv igen.': 'Could not complete the purchase. Try again.',
  'Din afdeling er ikke tilknyttet din profil. Kontakt din administrator.': 'Your profile is not linked to a department. Contact your administrator.',
  'Biometrisk login kunne ikke deaktiveres. Prøv igen.': 'Could not disable biometric sign-in. Try again.',
  'Biometrisk login er slået fra, men de gemte loginoplysninger kunne ikke slettes.': 'Biometric sign-in is off, but saved credentials could not be deleted.',
  'Konfigurér Face ID eller fingeraftryk i telefonens indstillinger først.': 'Set up Face ID or fingerprint authentication in your phone settings first.',
  'Log ind med din adgangskode én gang for at aktivere Face ID på denne telefon.': 'Sign in with your password once to enable Face ID on this phone.',
  'Biometrisk login blev ikke aktiveret. Prøv igen.': 'Biometric sign-in was not enabled. Try again.',
  'Skriv din nuværende adgangskode.': 'Enter your current password.',
  'Adgangskoden opfylder ikke alle krav endnu.': 'The password does not meet all requirements yet.',
  'Den nuværende adgangskode er forkert.': 'The current password is incorrect.',
  'Adgangskoden kunne ikke ændres. Prøv igen.': 'Could not change the password. Try again.',
  'Adgangskoden er opdateret.': 'Password updated.',
  'Din anmodning om sletning er sendt til en administrator.': 'Your deletion request has been sent to an administrator.',
  'Tilbage til log ind': 'Back to sign in',
  'Tjek din e-mail': 'Check your email',
  'Bekræft din e-mailadresse. Log derefter ind for at følge din anmodning om adgang.': 'Confirm your email address, then sign in to follow your access request.',
  'Opret profil': 'Create account',
  'Vælg din virksomhed. En administrator skal godkende din adgang.': 'Choose your company. An administrator must approve your access.',
  'Dit navn': 'Your name',
  'navn@virksomhed.dk': 'name@company.com',
  'Der er ingen aktive virksomheder at vælge lige nu.': 'There are no active companies to choose from right now.',
  'Din anmodning gennemgås af virksomhedens administrator.': 'Your request will be reviewed by your company administrator.',
  'Mindst 6 tegn': 'At least 6 characters',
  'Har du allerede en konto?': 'Already have an account?',
  'Log ind': 'Sign in',
  'Log ind med ': 'Sign in with ',
  'Ny her? Opret profil': 'New here? Create an account',
  'Din konto afventer godkendelse fra din virksomhedsadministrator.': 'Your account is waiting for approval from your company administrator.',
  'Din anmodning om adgang er blevet afvist. Kontakt din virksomhedsadministrator.': 'Your access request was declined. Contact your company administrator.',
  'Din konto er endnu ikke aktiv. Kontakt din virksomhedsadministrator.': 'Your account is not active yet. Contact your company administrator.',
  'Din konto er endnu ikke knyttet til en Frigo-profil. Kontakt din administrator.': 'Your account is not linked to a Frigo profile yet. Contact your administrator.',
  'E-mail eller adgangskode er forkert.': 'Email or password is incorrect.',
  'Bekræft din e-mail, før du logger ind.': 'Confirm your email before signing in.',
  'Der er for mange loginforsøg. Vent lidt, og prøv igen.': 'There have been too many sign-in attempts. Wait a moment and try again.',
  'Det lykkedes ikke at logge ind. Prøv igen.': 'Could not sign in. Please try again.',
  'Medarbejdere har ikke adgang til at logge ind på administration. Brug Frigo-appen i stedet.': 'Employees cannot sign in to the admin site. Use the Frigo app instead.',
  'Aktivér biometrisk login?': 'Enable biometric sign-in?',
  'Brug Face ID næste gang for at gøre det nemmere at komme i gang.': 'Use Face ID next time for quicker sign-in.',
  'Denne telefon understøtter ikke Face ID eller fingeraftryk.': 'This phone does not support Face ID or fingerprint authentication.',
  'Vi kunne ikke gemme dit valg. Prøv igen.': 'We could not save your choice. Try again.',
  'Face ID kunne ikke logge ind. Du kan bruge din adgangskode i stedet.': 'Face ID could not sign you in. You can use your password instead.',
  'Face ID kunne ikke kontrolleres. Brug din adgangskode i stedet.': 'Face ID could not be checked. Use your password instead.',
  'Log ind med din adgangskode én gang for at aktivere Face ID her.': 'Sign in with your password once to enable Face ID here.',
  'Log ind med din adgangskode for at aktivere Face ID igen.': 'Sign in with your password to enable Face ID again.',
  'ANMODNING AFVIST': 'REQUEST DECLINED',
  'AFVENTER GODKENDELSE': 'AWAITING APPROVAL',
  'Din anmodning blev afvist': 'Your request was declined',
  'Afventer godkendelse': 'Waiting for approval',
  'Du kan logge ind og se denne side, mens din virksomhedsadministrator gennemgår din anmodning.': 'You can sign in to check this page while your company administrator reviews your request.',
  'Vi kunne ikke indlæse status på din anmodning. Prøv igen om lidt.': 'We could not load your request status. Please try again shortly.',
  'Glemt adgangskode?': 'Forgot password?',
  'Skriv din e-mail, så sender vi et link til at vælge en ny adgangskode.': 'Enter your email and we will send a link to reset your password.',
  'Send nulstillingslink': 'Send reset link',
  'Hvis adressen er knyttet til en konto, sender vi et link.': 'If the address is linked to an account, we will send a link.',
  'Tjek din mail': 'Check your email',
  'Brug en anden e-mail': 'Use a different email',
  'Vælg ny adgangskode': 'Choose a new password',
  'Gem ny adgangskode': 'Save new password',
  'Adgangskoden er ændret': 'Password changed',
  'Du kan nu logge ind med din nye adgangskode.': 'You can now sign in with your new password.',
  'Glemt adgangskode': 'Forgot password',
  'Ma': 'Mon',
  'Ti': 'Tue',
  'On': 'Wed',
  'To': 'Thu',
  'Fr': 'Fri',
  'Lø': 'Sat',
  'Sø': 'Sun',
  'Øvrigt': 'Other',
  'Aktiv': 'Active',
  'Inaktiv': 'Inactive',
  'Afventer': 'Pending',
  'Afvist': 'Declined',
  'Slettet': 'Deleted',
  'Afventer adgangskode': 'Awaiting password setup',
  'vare er registreret': 'item has been registered',
  'varer er registreret': 'items have been registered',
  'og kan ses i din historik.': 'and can be viewed in your history.',
  'Der er ingen aktive produkter tilknyttet din afdeling endnu. Kontakt din administrator.': 'There are no active products assigned to your department yet. Contact your administrator.',
  'Der er ingen aktive produkter tilgængelige lige nu.': 'There are no active products available right now.',
  'Kataloget kunne ikke opdateres. Prøv igen.': 'Could not refresh the catalog. Try again.',
  'Afdelingsoplysningerne kunne ikke opdateres. Prøv igen.': 'Could not refresh department details. Try again.',
  'Anmodningen kunne ikke sendes: ': 'Could not send request: ',
  'Sletningsanmodningens status kunne ikke indlæses: ': 'Could not load deletion request status: ',
  'Log ind igen for at se brugere.': 'Sign in again to view users.',
  'Din profil er ikke tilknyttet en afdeling. Kontakt din administrator.': 'Your profile is not linked to a department. Contact your administrator.',
  'Læg i kurv': 'Add to cart',
  'Se kurv': 'View cart',
  'Rediger': 'Edit',
  'Slet': 'Delete',
  'Slet profil': 'Delete account',
  'Annuller': 'Cancel',
  'Bekræft': 'Confirm',
  'Du har en afventende anmodning om sletning af din profil.': 'You have a pending account deletion request.',
  'Sletningsanmodning': 'Account deletion request',
  'Virksomheder kunne ikke indlæses: ': 'Could not load companies: ',
  'Ukendt fejl.': 'Unknown error.',
  'Nulstillingslink sendt': 'Reset link sent',
  'Log ind med biometrisk login': 'Sign in with biometrics',
  'Billedet blev ikke gemt. Prøv igen.': 'The image was not saved. Try again.',
  'Aktivér ': 'Enable ',
  'fingeraftryk': 'fingerprint',
  ' vare er registreret': ' item has been registered',
  ' varer er registreret': ' items have been registered',
  ' og kan ses i din historik.': ' and can be viewed in your history.',
  ' varer · ': ' items · ',
  'Afdelingsoplysningerne kunne ikke opdateres: ': 'Could not refresh department details: ',
  'Kataloget kunne ikke opdateres: ': 'Could not refresh the catalog: ',
  'Læg': 'Add',
  'i kurv': 'to cart',
  ' fra favoritter': ' from favorites',
  ' til favoritter': ' to favorites',
  'Fjern': 'Remove',
  'Tilføj': 'Add',
  'Sletningsanmodning sendt': 'Deletion request sent',
  'Din anmodning sendes til en administrator. Kontoen slettes først, når anmodningen er godkendt.': 'Your request will be sent to an administrator. Your account will only be deleted after the request is approved.',
  'Sender...': 'Sending...',
  'Send anmodning': 'Send request',
  'Forrige måned': 'Previous month',
  'Næste måned': 'Next month',
  'Registrerer…': 'Registering…',
  'Swipe for at registrere · ': 'Swipe to register · ',
  'Læg i kurv · ': 'Add to cart · ',
  ' kr pr. stk.': ' DKK each',
  ' varer': ' items',
  ' kroner': ' DKK',
  'Brug ': 'Use ',
  ' næste gang for at gøre det nemmere at komme i gang.': ' next time for quicker sign-in.',
  ' kunne ikke bekræfte dig. Prøv igen, eller vælg “Ikke nu”.': ' could not verify you. Try again or choose “Not now”.',
  'Linket er ugyldigt eller udløbet. Bed om et nyt nulstillingslink.': 'The link is invalid or has expired. Request a new reset link.',
  'Skriv en gyldig e-mailadresse.': 'Enter a valid email address.',
  'Nulstillingslinket kunne ikke sendes. Prøv igen senere.': 'Could not send the reset link. Try again later.',
  'Adgangskoden kunne ikke ændres. Bed om et nyt nulstillingslink, og prøv igen.': 'Could not change the password. Request a new reset link and try again.',
  'Åbner...': 'Opening...',
  'Tilføjet': 'Added',
  'Registrering gennemført for ': 'Registration completed for ',
};

function translateString(value: string, language: AppLanguage): string {
  if (language === 'da') return value;
  const exactTranslation = englishTranslations[value];
  if (exactTranslation) return exactTranslation;

  const cartCount = value.match(/^Kurv, (\d+) varer?$/);
  if (cartCount) return `Cart, ${cartCount[1]} ${Number(cartCount[1]) === 1 ? 'item' : 'items'}`;

  const itemCount = value.match(/^(\d+) varer?$/);
  if (itemCount) return `${itemCount[1]} ${Number(itemCount[1]) === 1 ? 'item' : 'items'}`;

  const registeredCount = value.match(/^(\d+) (vare er registreret|varer er registreret) og kan ses i din historik\.$/);
  if (registeredCount) {
    const itemText = Number(registeredCount[1]) === 1 ? 'item has been registered' : 'items have been registered';
    return `${registeredCount[1]} ${itemText} and can be viewed in your history.`;
  }

  const resetEmailMessage = value.match(/^Hvis (.+) er knyttet til en konto, modtager du snart et link til at nulstille adgangskoden\.$/);
  if (resetEmailMessage) return `If ${resetEmailMessage[1]} is linked to an account, you will receive a password reset link shortly.`;

  const purchaseNotice = value.match(/^Registrering gennemført for (\d+) varer?\.$/);
  if (purchaseNotice) return `Purchase recorded for ${purchaseNotice[1]} ${Number(purchaseNotice[1]) === 1 ? 'item' : 'items'}.`;

  const purchaseCount = value.match(/^Registrering gennemført for (\d+) varer?$/);
  if (purchaseCount) return `Purchase recorded for ${purchaseCount[1]} ${Number(purchaseCount[1]) === 1 ? 'item' : 'items'}`;

  const cartAdded = value.match(/^(\d+) × (.+) er lagt i kurven$/);
  if (cartAdded) return `Added ${cartAdded[1]} × ${cartAdded[2]} to the cart.`;

  const biometricUnavailable = value.match(/^(.+) er ikke tilgængelig på denne enhed\. Brug din adgangskode i stedet\.$/);
  if (biometricUnavailable) return `${translateString(biometricUnavailable[1], language)} is not available on this device. Use your password instead.`;

  const errorTranslations: Array<[RegExp, string]> = [
    [/^Kataloget kunne ikke opdateres: (.+)$/, 'Could not refresh the catalog: $1'],
    [/^Afdelingsoplysningerne kunne ikke opdateres: (.+)$/, 'Could not refresh department details: $1'],
    [/^Sletningsanmodningens status kunne ikke indlæses: (.+)$/, 'Could not load deletion request status: $1'],
    [/^Anmodningen kunne ikke sendes: (.+)$/, 'Could not send request: $1'],
    [/^Profilbilledet kunne ikke gemmes: (.+)$/, 'Could not save profile photo: $1'],
  ];
  for (const [pattern, translation] of errorTranslations) {
    const match = value.match(pattern);
    if (match) return translation.replace('$1', match[1]);
  }

  return value.replace(/ kr\b/g, ' DKK');
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function AppLanguageProvider({ children }: { children: ReactNode }) {
  const locales = useLocales();
  const deviceLanguage: AppLanguage = locales[0]?.languageCode?.toLowerCase() === 'da' ? 'da' : 'en';
  const [language, setLanguageState] = useState<AppLanguage>(deviceLanguage);
  const [hasManualPreference, setHasManualPreference] = useState(false);

  useEffect(() => {
    let isActive = true;
    void SecureStore.getItemAsync(languageStorageKey)
      .then((storedLanguage) => {
        if (!isActive) return;
        if (storedLanguage === 'da' || storedLanguage === 'en') {
          setLanguageState(storedLanguage);
          setHasManualPreference(true);
        } else {
          setLanguageState(deviceLanguage);
          setHasManualPreference(false);
        }
      })
      .catch(() => {
        if (isActive) setLanguageState(deviceLanguage);
      });
    return () => { isActive = false; };
  }, [deviceLanguage]);

  useEffect(() => {
    if (!hasManualPreference) setLanguageState(deviceLanguage);
  }, [deviceLanguage, hasManualPreference]);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    setHasManualPreference(true);
    try {
      await SecureStore.setItemAsync(languageStorageKey, nextLanguage);
    } catch {
      setHasManualPreference(false);
      setLanguageState(deviceLanguage);
    }
  }, [deviceLanguage]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useAppLanguage must be used inside AppLanguageProvider.');
  return context;
}

function translateNode(children: ReactNode, language: AppLanguage): ReactNode {
  if (typeof children === 'string') return translateString(children, language);
  if (Array.isArray(children)) return children.map((child) => translateNode(child, language));
  return children;
}

export function LocalizedText({ children, ...props }: TextProps) {
  const { language } = useAppLanguage();
  return <NativeText {...props}>{translateNode(children, language)}</NativeText>;
}

export function LocalizedTextInput({ placeholder, ...props }: TextInputProps) {
  const { language } = useAppLanguage();
  return <NativeTextInput {...props} placeholder={placeholder ? translateString(placeholder, language) : undefined} />;
}