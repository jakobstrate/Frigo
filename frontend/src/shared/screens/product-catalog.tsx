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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/backend/src/supabase';

const colors = {
  background: '#EDF2F6',
  ink: '#1A2344',
  muted: '#687487',
  line: '#D8E0E8',
  blue: '#1028D8',
  white: '#FFFFFF',
  green: '#21824E',
  favorite: '#C84016',
};

type Product = {
  id: string;
  name: string;
  size: string;
  price: number;
  category: string;
  color: string;
  description: string;
};

type CatalogTab = 'products' | 'favorites' | 'history' | 'settings';

const categories = ['Alle', 'Sodavand', 'Energi', 'Vand', 'Mejeri', 'Juice'];
const categoryWidths: Record<string, number> = {
  Alle: 76,
  Sodavand: 120,
  Energi: 94,
  Vand: 82,
  Mejeri: 90,
  Juice: 82,
};

const products: Product[] = [
  { id: 'cola', name: 'Cola', size: '33 cl', price: 12, category: 'Sodavand', color: '#FCE4E1', description: 'Klassisk cola. Serveres bedst iskold.' },
  { id: 'cola-zero', name: 'Cola uden sukker', size: '33 cl', price: 12, category: 'Sodavand', color: '#E5E8F0', description: 'Den klassiske colasmag uden sukker.' },
  { id: 'lemon-soda', name: 'Citronsodavand', size: '33 cl', price: 12, category: 'Sodavand', color: '#E2F3E5', description: 'Frisk, perlende citronsmag.' },
  { id: 'energy-drink', name: 'Energidrik', size: '25 cl', price: 17, category: 'Energi', color: '#E1E9FF', description: 'Sukkerfri energidrik med koffein. Bedst kold.' },
  { id: 'chocolate-milk', name: 'Kakaomælk', size: '27 cl', price: 12, category: 'Mejeri', color: '#FFF0D7', description: 'Cremet kakaomælk til en lille pause.' },
  { id: 'protein-shake', name: 'Proteinshake', size: '33 cl', price: 20, category: 'Mejeri', color: '#EFE6F8', description: 'Proteinrig shake med mild vaniljesmag.' },
  { id: 'spring-water', name: 'Kildevand', size: '50 cl', price: 10, category: 'Vand', color: '#DFF1F7', description: 'Stille kildevand i praktisk flaske.' },
  { id: 'orange-juice', name: 'Appelsinjuice', size: '25 cl', price: 15, category: 'Juice', color: '#FCE8D8', description: 'Frisk appelsinjuice, klar til at drikke.' },
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
  const safeAreaInsets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<CatalogTab>('products');
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(['energy-drink', 'protein-shake']);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartNotice, setCartNotice] = useState('');
  const cartSwipeWidth = useRef(0);
  const cartSwipeTranslation = useRef(new Animated.Value(0)).current;
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [cartAddedMessage, setCartAddedMessage] = useState('');
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
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
  const cartSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dx > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => {
      const maxTranslation = Math.max(0, cartSwipeWidth.current - 80);
      cartSwipeTranslation.setValue(Math.max(0, Math.min(gesture.dx, maxTranslation)));
    },
    onPanResponderRelease: (_event, gesture) => {
      const maxTranslation = Math.max(0, cartSwipeWidth.current - 80);
      if (maxTranslation > 0 && gesture.dx >= maxTranslation * 0.78) {
        setCartNotice(`Registrering gennemført for ${cartCount} varer (demo).`);
        setCart({});
        cartSwipeTranslation.setValue(0);
        return;
      }
      Animated.spring(cartSwipeTranslation, { toValue: 0, useNativeDriver: true, bounciness: 5 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(cartSwipeTranslation, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [cartCount, cartSwipeTranslation]);
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
    setCartNotice('');
    cartSwipeTranslation.setValue(0);
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

  function openCart() {
    setSelectedProduct(null);
    setShowCart(true);
  }

  function openProduct(product: Product) {
    setSelectedProduct(product);
    setSelectedQuantity(1);
    setCartAddedMessage('');
  }

  function addSelectedProductToCart() {
    if (!selectedProduct) return;
    updateCart(selectedProduct.id, selectedQuantity);
    setCartAddedMessage(`${selectedQuantity} × ${selectedProduct.name} er lagt i kurven`);
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
    setShowDeleteConfirm(true);
  }

  function submitDeleteRequest() {
    setShowDeleteConfirm(false);
    setShowDeleteSuccess(true);
  }

  if (showCart) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.cartPage}>
          <View style={styles.cartPageHeader}>
            <Pressable accessibilityRole="button" onPress={() => setShowCart(false)} style={styles.cartBackButton}>
              <ChevronLeft color={colors.blue} size={25} strokeWidth={2.5} />
              <Text style={styles.cartBackText}>Produkter</Text>
            </Pressable>
          </View>

          <View style={styles.cartTitleRow}>
            <Text style={styles.cartPageTitle}>Kurv</Text>
            {cartCount > 0 && <Text style={styles.cartCountLabel}>{cartCount} varer</Text>}
          </View>

          {cartItems.length === 0 ? (
            <View style={styles.cartEmptyState}>
              {cartNotice ? <Check color={colors.green} size={40} strokeWidth={2.5} /> : <ShoppingBag color={colors.blue} size={38} strokeWidth={1.8} />}
              <Text style={styles.cartEmptyTitle}>{cartNotice ? 'Registrering gennemført' : 'Kurven er tom'}</Text>
              <Text style={styles.emptyText}>{cartNotice || 'Vælg et produkt for at lægge det i kurven.'}</Text>
              <Pressable accessibilityRole="button" onPress={() => setShowCart(false)} style={styles.cartContinueButton}>
                <Text style={styles.cartContinueText}>Se produkter</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView style={styles.cartPageItems} contentContainerStyle={styles.cartPageList} showsVerticalScrollIndicator={false}>
                <View style={styles.cartCard}>
                  {cartItems.map((product, index) => (
                    <View key={product.id} style={[styles.cartPageRow, index < cartItems.length - 1 && styles.cartPageRowDivider]}>
                      <View style={[styles.cartPageProductIcon, { backgroundColor: product.color }]}>
                        <CupSoda color="#142A8F" size={23} strokeWidth={1.8} />
                      </View>
                      <View style={styles.cartPageProductInfo}>
                        <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productDetails}>{product.price} kr pr. stk.</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={cart[product.id] > 1 ? `Fjern én ${product.name}` : `Fjern ${product.name} fra kurven`}
                        onPress={() => updateCart(product.id, -1)}
                        style={styles.cartQuantityButton}>
                        {cart[product.id] > 1
                          ? <Minus color={colors.ink} size={17} />
                          : <Trash2 color="#C52C29" size={17} />}
                      </Pressable>
                      <Text style={styles.cartPageQuantity}>{cart[product.id]}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Tilføj én ${product.name}`} onPress={() => updateCart(product.id, 1)} style={styles.cartPlusButton}>
                        <Plus color={colors.white} size={18} strokeWidth={2.2} />
                      </Pressable>
                      <Text style={styles.cartPageLineTotal}>{product.price * cart[product.id]} kr</Text>
                    </View>
                  ))}
                  <View style={styles.cartPageTotalRow}>
                    <Text style={styles.cartPageTotalLabel}>I alt</Text>
                    <Text style={styles.cartPageTotalPrice}>{cartTotal} kr</Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.cartPageFooter}>
                <View
                  onLayout={(event) => { cartSwipeWidth.current = event.nativeEvent.layout.width; }}
                  style={styles.cartSwipeTrack}>
                  <Text pointerEvents="none" style={styles.cartSwipeLabel}>Swipe for at registrere · {cartCount} varer</Text>
                  <Animated.View
                    accessibilityRole="button"
                    accessibilityLabel={`Swipe for at registrere ${cartCount} varer`}
                    {...cartSwipeResponder.panHandlers}
                    style={[styles.cartSwipeThumb, { transform: [{ translateX: cartSwipeTranslation }] }]}>
                    <ChevronRight color={colors.white} size={26} strokeWidth={2.5} />
                  </Animated.View>
                </View>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
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
              onPress={openCart}
              style={styles.cartButton}>
              <ShoppingBag color={colors.blue} size={22} strokeWidth={2} />
              {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}
            </Pressable>
          )}
        </View>

        {demoMode && <Text style={styles.demoLabel}>DEMO · EKSEMPELDATA</Text>}

        <View style={styles.content}>
          {(activeTab === 'products' || activeTab === 'favorites') && (
            <ScrollView
              style={styles.productContentScroll}
              contentContainerStyle={styles.productContent}
              showsVerticalScrollIndicator={false}>
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
                      style={[styles.categoryChip, { width: categoryWidths[category] }, activeCategory === category && styles.categoryChipActive]}>
                      <Text numberOfLines={1} style={[styles.categoryText, activeCategory === category && styles.categoryTextActive]}>{category}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={styles.productList}>
                {shownProducts.map((product) => (
                  <View key={product.id} style={styles.productCard}>
                    <Pressable accessibilityRole="button" onPress={() => openProduct(product)} style={styles.productMain}>
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
                      accessibilityLabel={`Læg ${product.name} i kurv`}
                      onPress={() => updateCart(product.id, 1)}
                      style={styles.quickAddButton}>
                      <Plus color={colors.blue} size={19} strokeWidth={2.2} />
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
              </View>
            </ScrollView>
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

        {cartCount > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Gå til kurv. ${cartCount} varer, i alt ${cartTotal} kroner`}
            onPress={openCart}
            style={({ pressed }) => [styles.cartBar, pressed && styles.pressed]}>
            <View style={styles.cartBarCopy}>
              <Text style={styles.cartBarTitle}>Gå til kurv</Text>
              <Text style={styles.cartBarSubtitle}>{cartCount} varer · {cartTotal} kr</Text>
            </View>
            <View style={styles.cartBarArrow}>
              <ChevronRight color={colors.white} size={22} strokeWidth={2.2} />
            </View>
          </Pressable>
        )}

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
        {selectedProduct && (
          <View style={[
            styles.detailSafeArea,
            {
              paddingTop: Math.max(safeAreaInsets.top, Platform.OS === 'ios' ? 64 : 24),
              paddingBottom: safeAreaInsets.bottom,
            },
          ]}>
            <StatusBar style="dark" />
            <View style={styles.detailPage}>
              <View style={styles.detailHeader}>
                <Pressable accessibilityRole="button" onPress={() => setSelectedProduct(null)} style={styles.detailBackButton}>
                  <ChevronLeft color={colors.blue} size={23} strokeWidth={2.5} />
                  <Text style={styles.detailBackText}>Produkter</Text>
                </Pressable>
                <View style={styles.detailHeaderActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={favorites.includes(selectedProduct.id) ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
                    onPress={() => toggleFavorite(selectedProduct.id)}
                    style={styles.detailRoundButton}>
                    <Heart color={favorites.includes(selectedProduct.id) ? colors.favorite : colors.ink} fill={favorites.includes(selectedProduct.id) ? colors.favorite : 'transparent'} size={19} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Kurv, ${cartCount} varer`} onPress={openCart} style={styles.detailRoundButton}>
                    <ShoppingBag color={colors.blue} size={20} />
                    {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}
                  </Pressable>
                </View>
              </View>

              {cartAddedMessage !== '' && (
                <View style={styles.cartAddedBanner}>
                  <View style={styles.cartAddedCheck}><Check color={colors.white} size={15} strokeWidth={3} /></View>
                  <Text style={styles.cartAddedText}>{cartAddedMessage}</Text>
                  <Pressable accessibilityRole="button" onPress={openCart} style={styles.cartAddedLink}>
                    <Text style={styles.cartAddedLinkText}>Gå til kurv</Text>
                  </Pressable>
                </View>
              )}

              <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.detailHero, { backgroundColor: selectedProduct.color }]}>
                  <CupSoda color="#142A8F" size={78} strokeWidth={1.5} />
                </View>
                <Text style={styles.detailCategory}>{selectedProduct.category} · {selectedProduct.size}</Text>
                <Text style={styles.detailTitle}>{selectedProduct.name}</Text>
                <Text style={styles.detailDescription}>{selectedProduct.description}</Text>

                <View style={styles.quantityCard}>
                  <View style={styles.quantityCopy}>
                    <Text style={styles.quantityTitle}>Antal</Text>
                    <Text style={styles.quantityPrice}>{selectedProduct.price} kr pr. stk.</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fjern én"
                    disabled={selectedQuantity <= 1}
                    onPress={() => setSelectedQuantity((quantity) => Math.max(1, quantity - 1))}
                    style={[styles.detailQuantityButton, selectedQuantity <= 1 && styles.detailQuantityDisabled]}>
                    <Minus color={selectedQuantity <= 1 ? '#8D98AA' : colors.ink} size={18} />
                  </Pressable>
                  <View style={styles.quantityValueBox}><Text style={styles.quantityValue}>{selectedQuantity}</Text></View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tilføj én"
                    onPress={() => setSelectedQuantity((quantity) => quantity + 1)}
                    style={styles.detailQuantityButtonActive}>
                    <Plus color={colors.white} size={19} />
                  </Pressable>
                </View>
                {demoMode && <Text style={styles.detailDemoNote}>Produkt og pris er mock-data.</Text>}
              </ScrollView>

              <View style={styles.detailFooter}>
                <Pressable accessibilityRole="button" onPress={addSelectedProductToCart} style={({ pressed }) => [styles.detailAddButton, pressed && styles.pressed]}>
                  <ShoppingBag color={colors.white} size={19} />
                  <Text style={styles.detailAddButtonText}>Læg i kurv · {selectedProduct.price * selectedQuantity} kr</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      <Modal animationType="fade" transparent visible={showDeleteConfirm} onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.deleteModalBackdrop}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIcon}>
              <Trash2 color="#C52C29" size={25} />
            </View>
            <Text style={styles.deleteModalTitle}>Slet din profil?</Text>
            <Text style={styles.deleteModalText}>
              Vi sender en anmodning til din virksomheds admin, som sletter profilen. Indtil da kan du stadig logge ind og registrere. Dine registreringer gemmes i 5 år og slettes derefter.
            </Text>
            <Text style={styles.deleteModalDemoNote}>Demo: der sendes ingen rigtig anmodning.</Text>
            <Pressable accessibilityRole="button" onPress={submitDeleteRequest} style={({ pressed }) => [styles.deleteConfirmButton, pressed && styles.pressed]}>
              <Text style={styles.deleteConfirmText}>Send sletteanmodning</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setShowDeleteConfirm(false)} style={styles.deleteCancelButton}>
              <Text style={styles.deleteCancelText}>Fortryd</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={showDeleteSuccess} onRequestClose={() => setShowDeleteSuccess(false)}>
        <View style={styles.deleteModalBackdrop}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteSuccessIcon}>
              <Check color={colors.white} size={25} strokeWidth={3} />
            </View>
            <Text style={styles.deleteModalTitle}>Anmodning sendt</Text>
            <Text style={styles.deleteModalText}>
              Din sletteanmodning er sendt til din virksomhedsadministrator.
            </Text>
            <Text style={styles.deleteModalDemoNote}>Demo: din profil er ikke slettet, og anmodningen er ikke sendt til serveren.</Text>
            <Pressable accessibilityRole="button" onPress={() => setShowDeleteSuccess(false)} style={styles.deleteSuccessButton}>
              <Text style={styles.saveButtonText}>Tilbage til indstillinger</Text>
            </Pressable>
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
      <View
        accessibilityRole="checkbox"
        accessibilityState={{ checked: passed }}
        style={[
          styles.passwordRequirementIcon,
          {
            backgroundColor: passed ? '#21824E' : colors.background,
            borderColor: passed ? '#21824E' : '#B8C2D0',
            borderWidth: passed ? 0 : 2,
          },
        ]}>
        {passed && <Check color="#FFFFFF" size={14} strokeWidth={3} />}
      </View>
      <Text style={[styles.passwordRequirementText, passed && styles.passwordRequirementTextPassed]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  cartPage: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18 },
  cartPageHeader: { minHeight: 48, justifyContent: 'center', marginBottom: 14 },
  cartBackButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartBackText: { color: colors.blue, fontSize: 14, fontWeight: '600' },
  cartTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  cartPageTitle: { color: colors.ink, fontSize: 40, lineHeight: 48, fontWeight: '700' },
  cartCountLabel: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  cartEmptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16 },
  cartEmptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  cartContinueButton: { minHeight: 48, justifyContent: 'center', marginTop: 10, paddingHorizontal: 24, borderRadius: 24, backgroundColor: colors.blue },
  cartContinueText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  cartPageItems: { flex: 1 },
  cartPageList: { paddingBottom: 10 },
  cartCard: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, borderRadius: 24, backgroundColor: colors.white },
  cartPageRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartPageRowDivider: { borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  cartPageProductIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  cartPageProductInfo: { flex: 1, minWidth: 48, gap: 3 },
  cartPageQuantity: { minWidth: 18, color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  cartQuantityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D5DDE5', borderRadius: 22, backgroundColor: colors.white },
  cartPlusButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.blue },
  cartPageLineTotal: { width: 48, color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  cartPageFooter: { paddingTop: 12 },
  cartSwipeTrack: { height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingLeft: 78, paddingRight: 12, borderRadius: 40, backgroundColor: '#E2E7FF', overflow: 'hidden' },
  cartSwipeLabel: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  cartSwipeThumb: { position: 'absolute', top: 5, left: 5, width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 35, backgroundColor: colors.blue },
  cartPageTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E8EDF2' },
  cartPageTotalLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  cartPageTotalPrice: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  pageTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  cartButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  cartBadge: { position: 'absolute', top: -1, right: -1, minWidth: 19, height: 19, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.blue },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  demoLabel: { paddingHorizontal: 20, paddingBottom: 7, color: colors.blue, fontSize: 10, fontWeight: '700' },
  demoNote: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  content: { flex: 1, paddingHorizontal: 18 },
  productContentScroll: { flex: 1 },
  productContent: { flexGrow: 0 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 25, backgroundColor: colors.white },
  searchInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 15 },
  categoryRow: { gap: 8, paddingTop: 10, paddingBottom: 2, paddingRight: 8 },
  categoryChip: { height: 42, flexShrink: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: colors.white },
  categoryChipActive: { borderColor: colors.blue, backgroundColor: colors.blue },
  categoryText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: colors.white },
  productList: { gap: 10, paddingTop: 0, paddingBottom: 16 },
  productCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.white },
  productMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 13 },
  productIcon: { width: 58, height: 58, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  productInfo: { flex: 1, minWidth: 0, gap: 3 },
  productName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  productDetails: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  quickAddButton: { width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#E8ECFF' },
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
  deleteModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(24, 31, 74, 0.58)' },
  deleteModalCard: { width: '100%', maxWidth: 430, alignItems: 'center', gap: 14, padding: 24, borderRadius: 24, backgroundColor: colors.white },
  deleteModalIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: '#FCE9E7' },
  deleteSuccessIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: colors.green },
  deleteModalTitle: { color: colors.ink, fontSize: 20, lineHeight: 27, fontWeight: '700', textAlign: 'center' },
  deleteModalText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  deleteModalDemoNote: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  deleteConfirmButton: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: '#C52C29' },
  deleteConfirmText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  deleteCancelButton: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 25, backgroundColor: colors.white },
  deleteCancelText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  deleteSuccessButton: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: colors.blue },
  cartBar: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 18, marginBottom: 10, paddingLeft: 22, paddingRight: 7, borderRadius: 34, backgroundColor: colors.blue },
  cartBarCopy: { gap: 2 },
  cartBarTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  cartBarSubtitle: { color: '#DDE3FF', fontSize: 12, fontWeight: '500' },
  cartBarArrow: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: '#2941E7' },
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
  detailSafeArea: { flex: 1, backgroundColor: colors.background },
  detailPage: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10 },
  detailHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  detailBackButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailBackText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  detailHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailRoundButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.white },
  cartAddedBanner: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#E1F3E8' },
  cartAddedCheck: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.green },
  cartAddedText: { flex: 1, color: '#175B38', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  cartAddedLink: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.white },
  cartAddedLinkText: { color: '#175B38', fontSize: 12, fontWeight: '600' },
  detailContent: { flexGrow: 1, paddingBottom: 20 },
  detailHero: { width: '100%', aspectRatio: 1.48, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  detailCategory: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 22 },
  detailTitle: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700', marginTop: 5 },
  quantityCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.white },
  quantityCopy: { flex: 1, gap: 3 },
  quantityTitle: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  quantityPrice: { color: colors.muted, fontSize: 12 },
  detailQuantityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#E9EDF2' },
  detailQuantityDisabled: { opacity: 0.62 },
  quantityValueBox: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  quantityValue: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  detailQuantityButtonActive: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.blue },
  detailDemoNote: { color: colors.muted, fontSize: 11, marginTop: 10 },
  detailFooter: { paddingTop: 10, paddingBottom: 6 },
  detailAddButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 30, backgroundColor: colors.blue },
  detailAddButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  addButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 26, backgroundColor: colors.blue },
  addButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  cartItems: { maxHeight: 360 },
  cartRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  quantityButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.white },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  totalPrice: { color: colors.ink, fontSize: 16, fontWeight: '700' },
});