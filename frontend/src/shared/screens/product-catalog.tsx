import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CircleUserRound,
  CupSoda,
  Heart,
  KeyRound,
  LayoutGrid,
  LogOut,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/backend/src/supabase';

const colors = {
  background: '#EDF2F6',
  ink: '#1A2344',
  muted: '#687487',
  line: '#D8E0E8',
  blue: '#1028D8',
  white: '#FFFFFF',
  favorite: '#C84016',
};

type Product = {
  id: string;
  name: string;
  size: string;
  price: number;
  category: string;
  color: string;
};

type CatalogTab = 'products' | 'favorites' | 'history' | 'settings';

const categories = ['Alle', 'Sodavand', 'Energi', 'Vand', 'Mejeri', 'Juice'];

const products: Product[] = [
  { id: 'cola', name: 'Cola', size: '33 cl', price: 12, category: 'Sodavand', color: '#FCE4E1' },
  { id: 'cola-zero', name: 'Cola uden sukker', size: '33 cl', price: 12, category: 'Sodavand', color: '#E5E8F0' },
  { id: 'lemon-soda', name: 'Citronsodavand', size: '33 cl', price: 12, category: 'Sodavand', color: '#E2F3E5' },
  { id: 'energy-drink', name: 'Energidrik', size: '25 cl', price: 17, category: 'Energi', color: '#E1E9FF' },
  { id: 'chocolate-milk', name: 'Kakaomælk', size: '27 cl', price: 12, category: 'Mejeri', color: '#FFF0D7' },
  { id: 'protein-shake', name: 'Proteinshake', size: '33 cl', price: 20, category: 'Mejeri', color: '#EFE6F8' },
  { id: 'spring-water', name: 'Kildevand', size: '50 cl', price: 10, category: 'Vand', color: '#DFF1F7' },
  { id: 'orange-juice', name: 'Appelsinjuice', size: '25 cl', price: 15, category: 'Juice', color: '#FCE8D8' },
];

const historyItems = [
  { label: 'Energidrik', detail: 'I dag · 17 kr' },
  { label: 'Cola uden sukker', detail: 'I går · 12 kr' },
  { label: 'Proteinshake', detail: 'Mandag · 20 kr' },
];

const biometricSetupKey = 'frigo-biometric-setup';

type ProductCatalogProps = {
  demoMode?: boolean;
};

export function ProductCatalog({ demoMode = false }: ProductCatalogProps) {
  const [activeTab, setActiveTab] = useState<CatalogTab>('products');
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(['energy-drink', 'protein-shake']);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [profileName, setProfileName] = useState('Fornavn Efternavn');
  const [profileEmail, setProfileEmail] = useState('name@pentia.dk');
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [hasMockPhoto, setHasMockPhoto] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricNotice, setBiometricNotice] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('MockPass1');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const hasPasswordMinimumLength = newPassword.length >= 8;
  const hasPasswordUpperAndLowercase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasPasswordNumber = /\d/.test(newPassword);
  const passwordsMismatch = repeatPassword.length > 0 && newPassword !== repeatPassword;
  const canSaveMockPassword = currentPassword.length > 0
    && hasPasswordMinimumLength
    && hasPasswordUpperAndLowercase
    && hasPasswordNumber
    && newPassword === repeatPassword;

  useEffect(() => {
    let isActive = true;
    void SecureStore.getItemAsync(biometricSetupKey)
      .then((value) => {
        if (isActive) setBiometricEnabled(value === 'enabled');
      })
      .catch(() => {
        if (isActive) setBiometricEnabled(false);
      });
    return () => { isActive = false; };
  }, []);

  const shownProducts = useMemo(() => products.filter((product) => {
    const matchesTab = activeTab !== 'favorites' || favorites.includes(product.id);
    const matchesCategory = activeCategory === 'Alle' || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesTab && matchesCategory && matchesSearch;
  }), [activeCategory, activeTab, favorites, search]);

  const cartItems = products.filter((product) => (cart[product.id] ?? 0) > 0);
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = cartItems.reduce((total, product) => total + product.price * cart[product.id], 0);
  const title = activeTab === 'products'
    ? 'Produkter'
    : activeTab === 'favorites'
      ? 'Favoritter'
      : activeTab === 'history'
        ? 'Historik'
        : 'Indstillinger';

  function toggleFavorite(productId: string) {
    setFavorites((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
  }

  function updateCart(productId: string, change: number) {
    setCart((current) => {
      const quantity = (current[productId] ?? 0) + change;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: quantity };
    });
  }

  function saveProfile() {
    if (!profileName.trim()) {
      setProfileError('Skriv dit navn.');
      setProfileNotice('');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())) {
      setProfileError('Skriv en gyldig e-mailadresse.');
      setProfileNotice('');
      return;
    }
    setProfileError('');
    setProfileNotice('Ændringer gemt i demoen.');
  }

  async function toggleBiometrics(enabled: boolean) {
    setBiometricNotice('');
    if (demoMode) {
      await SecureStore.setItemAsync(biometricSetupKey, enabled ? 'enabled' : 'skipped');
      setBiometricEnabled(enabled);
      setBiometricNotice('Demoindstillingen er opdateret.');
      return;
    }

    if (!enabled) {
      await SecureStore.setItemAsync(biometricSetupKey, 'skipped');
      setBiometricEnabled(false);
      return;
    }

    if (!(await LocalAuthentication.isEnrolledAsync())) {
      setBiometricNotice('Konfigurér Face ID eller fingeraftryk i telefonens indstillinger først.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Aktivér biometrisk login til Frigo',
      cancelLabel: 'Annuller',
    });
    if (result.success) {
      await SecureStore.setItemAsync(biometricSetupKey, 'enabled');
      setBiometricEnabled(true);
    } else {
      setBiometricNotice('Biometrisk login blev ikke aktiveret. Prøv igen.');
    }
  }

  function saveMockPassword() {
    if (!currentPassword.trim()) {
      setPasswordError('Skriv din nuværende adgangskode.');
      return;
    }
    if (!hasPasswordMinimumLength || !hasPasswordUpperAndLowercase || !hasPasswordNumber) {
      setPasswordError('Adgangskoden opfylder ikke alle krav endnu.');
      return;
    }
    if (newPassword !== repeatPassword) {
      setPasswordError('Adgangskoderne er ikke ens.');
      return;
    }
    setPasswordError('');
    setProfileNotice('Demo: adgangskoden er ikke ændret.');
    setNewPassword('');
    setRepeatPassword('');
    setShowPasswordModal(false);
  }

  async function logOut() {
    if (!demoMode) await supabase.auth.signOut();
    router.replace('/');
  }

  function confirmDeleteProfile() {
    Alert.alert('Slet profil', 'Demo: profilen bliver ikke slettet.', [{ text: 'OK' }]);
  }

  if (showPasswordModal) {
    const mismatchVisible = passwordsMismatch || passwordError === 'Adgangskoderne er ikke ens.';

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.passwordPage}>
          <ScrollView contentContainerStyle={styles.passwordContent} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" onPress={() => setShowPasswordModal(false)} style={styles.passwordBackButton}>
              <ChevronLeft color={colors.blue} size={25} strokeWidth={2.5} />
              <Text style={styles.passwordBackText}>Indstillinger</Text>
            </Pressable>

            <Text style={styles.passwordPageTitle}>Ny adgangskode</Text>

            <View style={styles.passwordFields}>
              <Text style={styles.passwordFieldLabel}>Nuværende adgangskode</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={(value) => { setCurrentPassword(value); setPasswordError(''); }}
                secureTextEntry
                style={styles.passwordInput}
                value={currentPassword}
              />

              <Text style={styles.passwordFieldLabel}>Ny adgangskode</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={(value) => { setNewPassword(value); setPasswordError(''); }}
                secureTextEntry
                style={styles.passwordInput}
                value={newPassword}
              />

              <View style={styles.passwordRequirements}>
                <PasswordRequirement label="Mindst 8 tegn" passed={hasPasswordMinimumLength} />
                <PasswordRequirement label="Store og små bogstaver" passed={hasPasswordUpperAndLowercase} />
                <PasswordRequirement label="Mindst ét tal" passed={hasPasswordNumber} />
              </View>

              <Text style={styles.passwordFieldLabel}>Gentag adgangskode</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={(value) => { setRepeatPassword(value); setPasswordError(''); }}
                secureTextEntry
                style={[styles.passwordInput, mismatchVisible && styles.passwordInputError]}
                value={repeatPassword}
              />
              {mismatchVisible && <Text accessibilityRole="alert" style={styles.passwordErrorText}>Adgangskoderne er ikke ens</Text>}
              {!!passwordError && !mismatchVisible && <Text accessibilityRole="alert" style={styles.passwordErrorText}>{passwordError}</Text>}
              <Text style={styles.passwordDemoNote}>Demo: adgangskoden bliver ikke ændret.</Text>
            </View>
          </ScrollView>

          <View style={styles.passwordFooter}>
            <Pressable
              accessibilityRole="button"
              disabled={!canSaveMockPassword}
              onPress={saveMockPassword}
              style={({ pressed }) => [styles.passwordSaveButton, !canSaveMockPassword && styles.passwordSaveButtonDisabled, pressed && canSaveMockPassword && styles.pressed]}>
              <Text style={[styles.passwordSaveText, !canSaveMockPassword && styles.passwordSaveTextDisabled]}>Gem adgangskode</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>{title}</Text>
          {activeTab !== 'settings' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Kurv, ${cartCount} varer`}
              onPress={() => setShowCart(true)}
              style={styles.cartButton}>
              <ShoppingBag color={colors.blue} size={22} strokeWidth={2} />
              {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}
            </Pressable>
          )}
        </View>

        {demoMode && <Text style={styles.demoLabel}>DEMO · EKSEMPELDATA</Text>}

        <View style={styles.content}>
          {(activeTab === 'products' || activeTab === 'favorites') && (
            <>
              <View style={styles.searchBox}>
                <Search color={colors.muted} size={19} />
                <TextInput
                  accessibilityLabel="Søg i produkter"
                  onChangeText={setSearch}
                  placeholder="Søg i produkter"
                  placeholderTextColor="#8A96AA"
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={search}
                />
                {!!search && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Ryd søgning" onPress={() => setSearch('')}>
                    <X color={colors.muted} size={18} />
                  </Pressable>
                )}
              </View>

              {activeTab === 'products' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                  {categories.map((category) => (
                    <Pressable
                      key={category}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activeCategory === category }}
                      onPress={() => setActiveCategory(category)}
                      style={[styles.categoryChip, activeCategory === category && styles.categoryChipActive]}>
                      <Text style={[styles.categoryText, activeCategory === category && styles.categoryTextActive]}>{category}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <ScrollView contentContainerStyle={styles.productList} showsVerticalScrollIndicator={false}>
                {shownProducts.map((product) => (
                  <View key={product.id} style={styles.productCard}>
                    <Pressable accessibilityRole="button" onPress={() => setSelectedProduct(product)} style={styles.productMain}>
                      <View style={[styles.productIcon, { backgroundColor: product.color }]}>
                        <CupSoda color="#142A8F" size={27} strokeWidth={1.8} />
                      </View>
                      <View style={styles.productInfo}>
                        <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productDetails}>{product.size} · {product.price} kr</Text>
                      </View>
                      <ChevronRight color={colors.muted} size={21} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={favorites.includes(product.id) ? `Fjern ${product.name} fra favoritter` : `Tilføj ${product.name} til favoritter`}
                      accessibilityState={{ selected: favorites.includes(product.id) }}
                      onPress={() => toggleFavorite(product.id)}
                      style={styles.favoriteButton}>
                      <Heart
                        color={favorites.includes(product.id) ? colors.favorite : colors.muted}
                        fill={favorites.includes(product.id) ? colors.favorite : 'transparent'}
                        size={20}
                        strokeWidth={2}
                      />
                    </Pressable>
                  </View>
                ))}
                {shownProducts.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>{activeTab === 'favorites' ? 'Ingen favoritter endnu' : 'Ingen produkter fundet'}</Text>
                    <Text style={styles.emptyText}>Prøv en anden søgning eller kategori.</Text>
                  </View>
                )}
              </ScrollView>
            </>
          )}

          {activeTab === 'history' && (
            <ScrollView contentContainerStyle={styles.simpleList}>
              {historyItems.map((item) => (
                <View key={item.label} style={styles.historyRow}>
                  <View style={styles.historyIcon}><Clock3 color={colors.blue} size={21} /></View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.label}</Text>
                    <Text style={styles.productDetails}>{item.detail}</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.demoNote}>Købshistorik er eksempeldata.</Text>
            </ScrollView>
          )}

          {activeTab === 'settings' && (
            <ScrollView contentContainerStyle={styles.settingsContent} showsVerticalScrollIndicator={false}>
              <View style={styles.profileCard}>
                <View style={styles.avatarRow}>
                  <View style={styles.profileAvatar}>
                    {hasMockPhoto
                      ? <CircleUserRound color={colors.blue} size={32} strokeWidth={1.8} />
                      : <UserRound color={colors.blue} size={30} strokeWidth={1.8} />}
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setHasMockPhoto((current) => !current)} style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>{hasMockPhoto ? 'Skift billede' : 'Skift billede'}</Text>
                  </Pressable>
                </View>

                <Text style={styles.settingsLabel}>Navn</Text>
                <TextInput
                  onChangeText={(value) => { setProfileName(value); setProfileError(''); setProfileNotice(''); }}
                  placeholder="Fornavn Efternavn"
                  placeholderTextColor="#8A96AA"
                  style={styles.settingsInput}
                  value={profileName}
                />
                <Text style={styles.settingsLabel}>E-mail</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(value) => { setProfileEmail(value); setProfileError(''); setProfileNotice(''); }}
                  placeholder="name@pentia.dk"
                  placeholderTextColor="#8A96AA"
                  style={styles.settingsInput}
                  value={profileEmail}
                />

                <View style={styles.passwordLabelRow}>
                  <View style={styles.passwordLabelGroup}>
                    <Text style={styles.settingsLabel}>Adgangskode</Text>
                    <Text style={styles.passwordMask}>••••••••</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => { setPasswordError(''); setShowPasswordModal(true); }} style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>Skift adgangskode</Text>
                  </Pressable>
                </View>

                <View style={styles.companyDepartmentRow}>
                  <View style={styles.companyDepartmentCell}>
                    <Text style={styles.companyDepartmentLabel}>Virksomhed</Text>
                    <Text style={styles.companyDepartmentValue}>Pentia Mobile</Text>
                  </View>
                  <View style={styles.companyDepartmentCell}>
                    <Text style={styles.companyDepartmentLabel}>Afdeling</Text>
                    <Text style={styles.companyDepartmentValue}>Udvikling</Text>
                  </View>
                </View>

                {(!!profileError || !!profileNotice) && (
                  <Text accessibilityRole={profileError ? 'alert' : 'text'} style={profileError ? styles.settingsError : styles.settingsNotice}>
                    {profileError || profileNotice}
                  </Text>
                )}

                <Pressable accessibilityRole="button" onPress={saveProfile} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                  <Text style={styles.saveButtonText}>Gem ændringer</Text>
                </Pressable>
                <Text style={styles.demoNote}>Profilændringer bruger mock-data.</Text>
              </View>

              <View style={styles.accountCard}>
                <View style={styles.biometricSettingRow}>
                  <View style={styles.accountRowIcon}>
                    <KeyRound color={colors.ink} size={20} />
                  </View>
                  <View style={styles.biometricSettingCopy}>
                    <Text style={styles.accountRowTitle}>Log ind med Face ID</Text>
                    <Text style={styles.accountRowSubtitle}>Til. Bruges næste gang du logger ind.</Text>
                  </View>
                  <Switch
                    accessibilityLabel="Log ind med Face ID"
                    onValueChange={(enabled) => { void toggleBiometrics(enabled); }}
                    thumbColor={colors.white}
                    trackColor={{ false: '#C8D0DB', true: colors.blue }}
                    value={biometricEnabled}
                  />
                </View>
                {!!biometricNotice && <Text style={styles.settingsNotice}>{biometricNotice}</Text>}
                <Pressable accessibilityRole="button" onPress={() => { void logOut(); }} style={styles.accountActionRow}>
                  <View style={styles.accountRowIcon}><LogOut color={colors.ink} size={20} /></View>
                  <Text style={styles.accountRowTitle}>Log ud</Text>
                  <ChevronRight color={colors.muted} size={21} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={confirmDeleteProfile} style={styles.deleteActionRow}>
                  <View style={styles.accountRowIcon}><Trash2 color="#C52C29" size={20} /></View>
                  <Text style={styles.deleteActionText}>Slet profil</Text>
                  <ChevronRight color="#C52C29" size={21} />
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.bottomNav}>
          <TabButton label="Produkter" active={activeTab === 'products'} onPress={() => setActiveTab('products')}>
            <LayoutGrid color={activeTab === 'products' ? colors.blue : colors.muted} size={23} strokeWidth={2} />
          </TabButton>
          <TabButton label="Favoritter" active={activeTab === 'favorites'} onPress={() => setActiveTab('favorites')}>
            <Heart color={activeTab === 'favorites' ? colors.blue : colors.muted} size={23} strokeWidth={2} />
          </TabButton>
          <TabButton label="Historik" active={activeTab === 'history'} onPress={() => setActiveTab('history')}>
            <Clock3 color={activeTab === 'history' ? colors.blue : colors.muted} size={23} strokeWidth={2} />
          </TabButton>
          <TabButton label="Indstillinger" active={activeTab === 'settings'} onPress={() => setActiveTab('settings')}>
            <SlidersHorizontal color={activeTab === 'settings' ? colors.blue : colors.muted} size={23} strokeWidth={2} />
          </TabButton>
        </View>
      </View>

      <Modal animationType="slide" transparent visible={!!selectedProduct} onRequestClose={() => setSelectedProduct(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Produkt</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Luk" onPress={() => setSelectedProduct(null)} style={styles.modalClose}>
                <X color={colors.ink} size={21} />
              </Pressable>
            </View>
            {selectedProduct && (
              <>
                <View style={[styles.detailIcon, { backgroundColor: selectedProduct.color }]}>
                  <CupSoda color="#142A8F" size={34} strokeWidth={1.8} />
                </View>
                <Text style={styles.detailName}>{selectedProduct.name}</Text>
                <Text style={styles.productDetails}>{selectedProduct.size} · {selectedProduct.price} kr</Text>
                <Text style={styles.detailDescription}>Mock-produkt fra {selectedProduct.category.toLowerCase()}-sortimentet.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    updateCart(selectedProduct.id, 1);
                    setSelectedProduct(null);
                  }}
                  style={styles.addButton}>
                  <Plus color={colors.white} size={20} />
                  <Text style={styles.addButtonText}>Læg i kurv · {selectedProduct.price} kr</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={showCart} onRequestClose={() => setShowCart(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kurv ({cartCount})</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Luk kurv" onPress={() => setShowCart(false)} style={styles.modalClose}>
                <X color={colors.ink} size={21} />
              </Pressable>
            </View>
            {cartItems.length === 0 ? (
              <Text style={styles.emptyText}>Kurven er tom. Vælg et produkt for at tilføje det.</Text>
            ) : (
              <>
                <ScrollView style={styles.cartItems}>
                  {cartItems.map((product) => (
                    <View key={product.id} style={styles.cartRow}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productDetails}>{product.price} kr · {cart[product.id]} stk.</Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Fjern én ${product.name}`} onPress={() => updateCart(product.id, -1)} style={styles.quantityButton}>
                        <Minus color={colors.ink} size={17} />
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Tilføj én ${product.name}`} onPress={() => updateCart(product.id, 1)} style={styles.quantityButton}>
                        <Plus color={colors.ink} size={17} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>I alt</Text>
                  <Text style={styles.totalPrice}>{cartTotal} kr</Text>
                </View>
                <Text style={styles.demoNote}>Kurven er kun til demonstration.</Text>
              </>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

type TabButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

function TabButton({ label, active, onPress, children }: TabButtonProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={styles.tabButton}>
      {children}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

type PasswordRequirementProps = {
  label: string;
  passed: boolean;
};

function PasswordRequirement({ label, passed }: PasswordRequirementProps) {
  return (
    <View style={styles.passwordRequirementRow}>
      <View style={[styles.passwordRequirementIcon, passed && styles.passwordRequirementIconPassed]}>
        {passed && <Check color={colors.white} size={14} strokeWidth={3} />}
      </View>
      <Text style={[styles.passwordRequirementText, passed && styles.passwordRequirementTextPassed]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  pageTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  cartButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  cartBadge: { position: 'absolute', top: -1, right: -1, minWidth: 19, height: 19, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.blue },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  demoLabel: { paddingHorizontal: 20, paddingBottom: 7, color: colors.blue, fontSize: 10, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 18 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 25, backgroundColor: colors.white },
  searchInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 15 },
  categoryRow: { gap: 8, paddingVertical: 15, paddingRight: 8 },
  categoryChip: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 17, borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: colors.white },
  categoryChipActive: { borderColor: colors.blue, backgroundColor: colors.blue },
  categoryText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: colors.white },
  productList: { gap: 10, paddingBottom: 16 },
  productCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.white },
  productMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 13 },
  productIcon: { width: 58, height: 58, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  productInfo: { flex: 1, minWidth: 0, gap: 3 },
  productName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  productDetails: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  favoriteButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', gap: 6, paddingVertical: 36 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  simpleList: { gap: 10, paddingTop: 16 },
  historyRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 17, backgroundColor: colors.white },
  historyIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#E5E9FF' },
  settingsContent: { gap: 12, paddingBottom: 16 },
  profileCard: { gap: 11, padding: 16, borderRadius: 20, backgroundColor: colors.white },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 3 },
  profileAvatar: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31, backgroundColor: '#E2E7FF' },
  outlineButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 23, backgroundColor: colors.white },
  outlineButtonText: { color: colors.blue, fontSize: 13, fontWeight: '600' },
  settingsLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  settingsInput: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white, color: colors.ink, fontSize: 14 },
  passwordLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 1 },
  passwordLabelGroup: { gap: 4 },
  passwordMask: { color: colors.ink, fontSize: 15, letterSpacing: 1.4 },
  companyDepartmentRow: { flexDirection: 'row', gap: 10, marginTop: 3 },
  companyDepartmentCell: { minHeight: 60, flex: 1, justifyContent: 'center', gap: 3, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.background },
  companyDepartmentLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  companyDepartmentValue: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  settingsError: { color: '#A52B28', backgroundColor: '#FCE9E7', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, fontSize: 12, lineHeight: 18 },
  settingsNotice: { color: '#236443', backgroundColor: '#E3F3E9', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, fontSize: 12, lineHeight: 18 },
  saveButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 2, borderRadius: 26, backgroundColor: colors.blue },
  saveButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  accountCard: { paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.white },
  biometricSettingRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  accountRowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  biometricSettingCopy: { flex: 1, gap: 3 },
  accountRowTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  accountRowSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  accountActionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  deleteActionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9 },
  deleteActionText: { flex: 1, color: '#C52C29', fontSize: 14, fontWeight: '600' },
  passwordPage: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  passwordContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  passwordBackButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5 },
  passwordBackText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  passwordPageTitle: { color: colors.ink, fontSize: 29, lineHeight: 38, fontWeight: '700', marginTop: 38, marginBottom: 24 },
  passwordFields: { gap: 10 },
  passwordFieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 6 },
  passwordInput: { minHeight: 54, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white, color: colors.ink, fontSize: 15 },
  passwordInputError: { borderWidth: 1.5, borderColor: '#D20F16' },
  passwordRequirements: { gap: 7, marginTop: 9, marginBottom: 6 },
  passwordRequirementRow: { minHeight: 29, flexDirection: 'row', alignItems: 'center', gap: 10 },
  passwordRequirementIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#B8C2D0', borderRadius: 14 },
  passwordRequirementIconPassed: { borderColor: colors.green, backgroundColor: colors.green },
  passwordRequirementText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  passwordRequirementTextPassed: { color: colors.green, fontWeight: '600' },
  passwordErrorText: { color: '#D20F16', fontSize: 12, fontWeight: '500', marginTop: -4 },
  passwordDemoNote: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  passwordFooter: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 18 },
  passwordSaveButton: { minHeight: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 30, backgroundColor: colors.blue },
  passwordSaveButtonDisabled: { backgroundColor: '#C8D0DB' },
  passwordSaveText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  passwordSaveTextDisabled: { color: '#586477' },
  bottomNav: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  tabButton: { minWidth: 64, flex: 1, minHeight: 66, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { color: colors.muted, fontSize: 10, fontWeight: '500' },
  tabLabelActive: { color: colors.blue, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 27, 55, 0.3)' },
  modalSheet: { maxHeight: '80%', paddingHorizontal: 22, paddingTop: 20, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  modalClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.white },
  detailIcon: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 18, alignSelf: 'center', marginBottom: 14 },
  detailName: { color: colors.ink, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  detailDescription: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12, marginBottom: 18 },
  addButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 26, backgroundColor: colors.blue },
  addButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  cartItems: { maxHeight: 360 },
  cartRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  quantityButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.white },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  totalPrice: { color: colors.ink, fontSize: 16, fontWeight: '700' },
});