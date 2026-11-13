import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import {
    CalendarDays,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
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
import { ActivityIndicator, Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
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
  id: number;
  name: string;
  size: string;
  price: number;
  category: string;
  color: string;
  description: string;
  imageUrl: string | null;
};

type EmployeeProfile = {
  id: string;
  display_name: string;
  email: string;
  company_id: number;
  department_id: number | null;
  companyName: string;
  departmentName: string;
};

type PurchaseHistoryItem = {
  id: number;
  product_name: string;
  amount: number;
  unit_price: number;
  total_price: number;
  created_at: string;
};

type CatalogTab = 'products' | 'favorites' | 'history' | 'settings';

const categoryWidths: Record<string, number> = {
  Alle: 76,
};

const productColors = ['#E1E9FF', '#FCE4E1', '#E2F3E5', '#FFF0D7', '#DFF1F7', '#EFE6F8'];

const biometricSetupKey = 'frigo-biometric-setup';

function getPurchasePeriodStart(date: Date) {
  return date.getDate() >= 21
    ? new Date(date.getFullYear(), date.getMonth(), 21)
    : new Date(date.getFullYear(), date.getMonth() - 1, 21);
}

function formatDayAndMonth(date: Date) {
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }).replace(/\./g, '');
}

function formatPurchasePeriod(start: Date, end: Date) {
  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatDayAndMonth(start)} ${start.getFullYear()} – ${formatDayAndMonth(end)} ${end.getFullYear()}`;
  }
  return `${formatDayAndMonth(start)} – ${formatDayAndMonth(end)} ${end.getFullYear()}`;
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftCalendarMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatCalendarMonth(date: Date) {
  const label = date.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatPickerDate(date: Date) {
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
}

function getCalendarWeeks(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const cells: Array<Date | null> = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

function getPurchaseDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatPurchaseDay(date: Date) {
  const label = date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ProductCatalog() {
  const safeAreaInsets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<CatalogTab>('products');
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Alle']);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [historyPeriodStart, setHistoryPeriodStart] = useState(() => getPurchasePeriodStart(new Date()));
  const [historyPeriodEnd, setHistoryPeriodEnd] = useState(() => {
    const start = getPurchasePeriodStart(new Date());
    return new Date(start.getFullYear(), start.getMonth() + 1, 20);
  });
  const [draftPeriodStart, setDraftPeriodStart] = useState(() => getPurchasePeriodStart(new Date()));
  const [draftPeriodEnd, setDraftPeriodEnd] = useState(() => {
    const start = getPurchasePeriodStart(new Date());
    return new Date(start.getFullYear(), start.getMonth() + 1, 20);
  });
  const [activePeriodField, setActivePeriodField] = useState<'from' | 'to'>('from');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const start = getPurchasePeriodStart(new Date());
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });
  const [showHistoryPeriodPicker, setShowHistoryPeriodPicker] = useState(false);
  const [showHistoryDetails, setShowHistoryDetails] = useState(false);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartNotice, setCartNotice] = useState('');
  const [registeredItemCount, setRegisteredItemCount] = useState(0);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const cartSwipeWidth = useRef(0);
  const cartSwipeTranslation = useRef(new Animated.Value(0)).current;
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [cartAddedMessage, setCartAddedMessage] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricNotice, setBiometricNotice] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hasPasswordMinimumLength = newPassword.length >= 8;
  const hasPasswordUpperAndLowercase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasPasswordNumber = /\d/.test(newPassword);
  const passwordsMismatch = repeatPassword.length > 0 && newPassword !== repeatPassword;
  const canSavePassword = currentPassword.length > 0
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

  useEffect(() => {
    let isActive = true;

    async function loadEmployeeData() {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (sessionError || !user) {
          router.replace('/');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, email, company_id, department_id, status')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError || !profile || profile.status !== 'active' || profile.company_id === null) {
          router.replace('/pending');
          return;
        }

        const [companyResult, departmentResult, categoriesResult, productsResult, membershipsResult, favoritesResult, purchasesResult] = await Promise.all([
          supabase.from('companies').select('name').eq('id', profile.company_id).maybeSingle(),
          profile.department_id
            ? supabase.from('departments').select('name').eq('id', profile.department_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('categories')
            .select('id, name, department_id')
            .or(`company_id.is.null,company_id.eq.${profile.company_id}`)
            .or(`department_id.is.null,department_id.eq.${profile.department_id ?? -1}`)
            .eq('active', true)
            .order('name'),
          supabase
            .from('products')
            .select('id, name, description, unit, price, image_path, category_id')
            .eq('active', true)
            .order('name'),
          profile.department_id
            ? supabase
                .from('department_products')
                .select('product_id')
                .eq('company_id', profile.company_id)
                .eq('department_id', profile.department_id)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('favorites').select('product_id').eq('user_id', user.id),
          supabase
            .from('purchases')
            .select('id, product_name, amount, unit_price, total_price, created_at')
            .eq('purchaser_id', user.id)
            .order('created_at', { ascending: false })
            .limit(500),
        ]);

        if (!isActive) return;
        if (productsResult.error) throw productsResult.error;

        const productRows = productsResult.data ?? [];
        const imagePaths = [...new Set(productRows.map((product) => product.image_path).filter(Boolean))];
        let imageByPath = new Map<string, string>();
        let imageLoadError: string | null = null;
        if (imagePaths.length > 0) {
          const { data: signedImages, error: signedImagesError } = await supabase.storage
            .from('product-images')
            .createSignedUrls(imagePaths, 3600);
          if (signedImagesError) {
            imageLoadError = signedImagesError.message;
          } else {
            imageByPath = new Map((signedImages ?? []).flatMap((image) => image.signedUrl ? [[image.path, image.signedUrl] as [string, string]] : []));
          }
        }

        const categoryById = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));
        setEmployeeProfile({
          id: profile.id,
          display_name: profile.display_name,
          email: profile.email,
          company_id: profile.company_id,
          department_id: profile.department_id,
          companyName: companyResult.data?.name ?? '',
          departmentName: departmentResult.data?.name ?? '',
        });
        setCategories(['Alle', ...new Set((categoriesResult.data ?? []).map((category) => category.name))]);
        setProducts(productRows.map((product, index) => ({
          id: product.id,
          name: product.name,
          size: product.unit,
          price: Number(product.price),
          category: categoryById.get(product.category_id) ?? 'Øvrigt',
          color: productColors[index % productColors.length],
          description: product.description ?? '',
          imageUrl: imageByPath.get(product.image_path) ?? null,
        })));
        setFavorites(favoritesResult.error ? [] : (favoritesResult.data ?? []).map((favorite) => favorite.product_id));
        setPurchaseHistory(purchasesResult.error ? [] : purchasesResult.data ?? []);
        if ((productsResult.data ?? []).length === 0) {
          setCatalogError(profile.department_id && !membershipsResult.error && (membershipsResult.data ?? []).length === 0
            ? 'Der er ingen aktive produkter tilknyttet din afdeling endnu. Kontakt din administrator.'
            : 'Der er ingen aktive produkter tilgængelige lige nu.');
        } else if (imageLoadError) {
          setCatalogError('Produktbillederne kunne ikke indlæses. Produktikoner vises i stedet.');
        } else if (categoriesResult.error || membershipsResult.error || favoritesResult.error || purchasesResult.error || companyResult.error || departmentResult.error) {
          setCatalogError('Nogle kategori-, profil- eller historikoplysninger kunne ikke indlæses. Produkterne er tilgængelige.');
        }
      } catch (loadError) {
        if (isActive) setCatalogError(loadError instanceof Error ? loadError.message : 'App-data kunne ikke indlæses. Prøv igen.');
      } finally {
        if (isActive) setCatalogLoading(false);
      }
    }

    void loadEmployeeData();
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
  const selectedHistory = useMemo(() => {
    const inclusiveEnd = new Date(historyPeriodEnd.getFullYear(), historyPeriodEnd.getMonth(), historyPeriodEnd.getDate() + 1);
    return purchaseHistory.filter((item) => {
      const createdAt = new Date(item.created_at);
      return createdAt >= historyPeriodStart && createdAt < inclusiveEnd;
    });
  }, [historyPeriodEnd, historyPeriodStart, purchaseHistory]);
  const historyPeriodTotal = selectedHistory.reduce((total, item) => total + Number(item.total_price), 0);
  const historyPeriodItemCount = selectedHistory.reduce((total, item) => total + item.amount, 0);
  const historyRegistrationCount = new Set(selectedHistory.map((item) => item.created_at)).size;
  const groupedHistory = useMemo(() => {
    const grouped = new Map<string, { date: Date; purchases: PurchaseHistoryItem[] }>();
    for (const purchase of selectedHistory) {
      const date = new Date(purchase.created_at);
      const key = getPurchaseDayKey(date);
      const day = grouped.get(key);
      if (day) day.purchases.push(purchase);
      else grouped.set(key, { date, purchases: [purchase] });
    }
    return [...grouped.values()];
  }, [selectedHistory]);
  const calendarMonths = useMemo(() => [calendarMonth, shiftCalendarMonth(calendarMonth, 1)], [calendarMonth]);
  const cartSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dx > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => {
      const maxTranslation = Math.max(0, cartSwipeWidth.current - 80);
      cartSwipeTranslation.setValue(Math.max(0, Math.min(gesture.dx, maxTranslation)));
    },
    onPanResponderRelease: (_event, gesture) => {
      const maxTranslation = Math.max(0, cartSwipeWidth.current - 80);
      if (maxTranslation > 0 && gesture.dx >= maxTranslation * 0.78) {
        void registerCart();
        return;
      }
      Animated.spring(cartSwipeTranslation, { toValue: 0, useNativeDriver: true, bounciness: 5 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(cartSwipeTranslation, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [cart, cartCount, cartSwipeTranslation, employeeProfile, isRegistering]);
  const title = activeTab === 'products'
    ? 'Produkter'
    : activeTab === 'favorites'
      ? 'Favoritter'
      : activeTab === 'history'
        ? 'Historik'
        : 'Indstillinger';

  async function toggleFavorite(productId: number) {
    if (!employeeProfile) return;
    const removing = favorites.includes(productId);
    setFavorites((current) => removing
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
    const result = removing
      ? await supabase.from('favorites').delete().eq('user_id', employeeProfile.id).eq('product_id', productId)
      : await supabase.from('favorites').insert({
          user_id: employeeProfile.id,
          company_id: employeeProfile.company_id,
          product_id: productId,
        });
    if (result.error) {
      setFavorites((current) => removing
        ? [...current, productId]
        : current.filter((id) => id !== productId));
      setCatalogError('Favoritten kunne ikke gemmes. Prøv igen.');
    }
  }

  function updateCart(productId: number, change: number) {
    setCartNotice('');
    setCatalogError('');
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

  function finishRegistration(openHistory: boolean) {
    setShowRegistrationSuccess(false);
    setShowCart(false);
    setCart({});
    setCartNotice('');
    setShowHistoryDetails(false);
    setActiveTab(openHistory ? 'history' : 'products');
    if (!openHistory) {
      setActiveCategory('Alle');
      setSearch('');
    }
  }

  async function registerCart() {
    if (isRegistering || cartItems.length === 0) return;
    if (!employeeProfile?.department_id) {
      setCartNotice('Din afdeling er ikke tilknyttet din profil. Kontakt din administrator.');
      Animated.spring(cartSwipeTranslation, { toValue: 0, useNativeDriver: true }).start();
      return;
    }

    setIsRegistering(true);
    setCartNotice('');
    const itemCount = cartCount;
    const rows = cartItems.map((product) => ({
      purchaser_id: employeeProfile.id,
      company_id: employeeProfile.company_id,
      department_id: employeeProfile.department_id,
      product_id: product.id,
      purchaser_name: employeeProfile.display_name,
      department_name: employeeProfile.departmentName,
      product_name: product.name,
      amount: cart[product.id],
      unit_price: product.price,
    }));

    try {
      const { error: purchaseError } = await supabase.from('purchases').insert(rows);
      if (purchaseError) throw purchaseError;

      if (Platform.OS === 'web') {
        setCart({});
        setCartNotice(`Registrering gennemført for ${itemCount} varer.`);
      } else {
        setRegisteredItemCount(itemCount);
        setShowRegistrationSuccess(true);
      }
      const { data: history, error: historyError } = await supabase
        .from('purchases')
        .select('id, product_name, amount, unit_price, total_price, created_at')
        .eq('purchaser_id', employeeProfile.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!historyError) setPurchaseHistory(history ?? []);
    } catch (purchaseError) {
      setCartNotice(purchaseError instanceof Error ? purchaseError.message : 'Registreringen kunne ikke gennemføres. Prøv igen.');
    } finally {
      setIsRegistering(false);
      cartSwipeTranslation.setValue(0);
    }
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

  async function toggleBiometrics(enabled: boolean) {
    setBiometricNotice('');
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

  async function savePassword() {
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
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) throw userError ?? new Error('Brugeren blev ikke fundet.');
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setPasswordError('Den nuværende adgangskode er forkert.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword('');
      setRepeatPassword('');
      setCurrentPassword('');
      setShowPasswordModal(false);
      setProfileNotice('Adgangskoden er opdateret.');
    } catch {
      setPasswordError('Adgangskoden kunne ikke ændres. Prøv igen.');
    }
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  function confirmDeleteProfile() {
    setShowDeleteConfirm(true);
  }

  function submitDeleteRequest() {
    setShowDeleteConfirm(false);
    setProfileNotice('Kontakt din virksomhedsadministrator for at få slettet din profil.');
  }

  function openHistoryPeriodPicker() {
    setDraftPeriodStart(historyPeriodStart);
    setDraftPeriodEnd(historyPeriodEnd);
    setCalendarMonth(new Date(historyPeriodStart.getFullYear(), historyPeriodStart.getMonth(), 1));
    setActivePeriodField('from');
    setShowHistoryPeriodPicker(true);
  }

  function setHistoryPreset(preset: 'standard' | 'last-seven-days' | 'this-year') {
    const today = normalizeDate(new Date());
    const start = preset === 'standard'
      ? getPurchasePeriodStart(today)
      : preset === 'last-seven-days'
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
        : new Date(today.getFullYear(), 0, 1);
    const end = preset === 'standard'
      ? new Date(start.getFullYear(), start.getMonth() + 1, 20)
      : today;
    setDraftPeriodStart(start);
    setDraftPeriodEnd(end);
    setCalendarMonth(new Date(start.getFullYear(), start.getMonth(), 1));
  }

  function selectHistoryDate(date: Date) {
    const selectedDate = normalizeDate(date);
    if (activePeriodField === 'from') {
      setDraftPeriodStart(selectedDate);
      if (selectedDate > draftPeriodEnd) setDraftPeriodEnd(selectedDate);
      setActivePeriodField('to');
      return;
    }
    if (selectedDate < draftPeriodStart) setDraftPeriodStart(selectedDate);
    else setDraftPeriodEnd(selectedDate);
  }

  function applyHistoryPeriod() {
    const start = normalizeDate(draftPeriodStart);
    const end = normalizeDate(draftPeriodEnd);
    setHistoryPeriodStart(start <= end ? start : end);
    setHistoryPeriodEnd(start <= end ? end : start);
    setShowHistoryPeriodPicker(false);
  }

  function isInDraftHistoryPeriod(date: Date) {
    const value = normalizeDate(date).getTime();
    return value >= normalizeDate(draftPeriodStart).getTime() && value <= normalizeDate(draftPeriodEnd).getTime();
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
                        {product.imageUrl
                          ? <Image contentFit="cover" source={{ uri: product.imageUrl }} style={styles.cartPageProductImage} />
                          : <CupSoda color="#142A8F" size={23} strokeWidth={1.8} />}
                      </View>
                      <View style={styles.cartPageProductInfo}>
                        <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productDetails}>{product.price} kr pr. stk.</Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={cart[product.id] > 1 ? `Fjern én ${product.name}` : `Fjern ${product.name} fra kurven`} onPress={() => updateCart(product.id, -1)} style={styles.cartQuantityButton}>
                        {cart[product.id] > 1 ? <Minus color={colors.ink} size={17} /> : <Trash2 color="#C52C29" size={17} />}
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
                {!!cartNotice && <Text accessibilityRole="alert" style={styles.cartDemoNotice}>{cartNotice}</Text>}
                <View onLayout={(event) => { cartSwipeWidth.current = event.nativeEvent.layout.width; }} style={styles.cartSwipeTrack}>
                  <Text pointerEvents="none" style={styles.cartSwipeLabel}>{isRegistering ? 'Registrerer…' : `Swipe for at registrere · ${cartCount} varer`}</Text>
                  <Animated.View
                    accessibilityRole="button"
                    accessibilityLabel={`Swipe for at registrere ${cartCount} varer`}
                    {...cartSwipeResponder.panHandlers}
                    style={[styles.cartSwipeThumb, { transform: [{ translateX: cartSwipeTranslation }] }]}
                  >
                    <ChevronRight color={colors.white} size={26} strokeWidth={2.5} />
                  </Animated.View>
                </View>
              </View>
            </>
          )}
        </View>
        <Modal
          animationType="slide"
          transparent
          visible={Platform.OS !== 'web' && showRegistrationSuccess}
          onRequestClose={() => finishRegistration(false)}>
          <View style={styles.registrationSuccessBackdrop}>
            <View style={[styles.registrationSuccessSheet, { paddingBottom: Math.max(safeAreaInsets.bottom, 20) }]}>
              <View style={styles.registrationSuccessIcon}>
                <Check color={colors.white} size={31} strokeWidth={2.8} />
              </View>
              <Text style={styles.registrationSuccessTitle}>Registreret</Text>
              <Text style={styles.registrationSuccessText}>
                {registeredItemCount} {registeredItemCount === 1 ? 'vare er registreret' : 'varer er registreret'} og kan ses i din historik.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => finishRegistration(false)}
                style={({ pressed }) => [styles.registrationSuccessPrimary, pressed && styles.pressed]}>
                <Text style={styles.registrationSuccessPrimaryText}>Færdig</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => finishRegistration(true)}
                style={({ pressed }) => [styles.registrationSuccessSecondary, pressed && styles.pressed]}>
                <Text style={styles.registrationSuccessSecondaryText}>Se historik</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
            </View>
          </ScrollView>

          <View style={styles.passwordFooter}>
            <Pressable
              accessibilityRole="button"
              disabled={!canSavePassword}
              onPress={() => { void savePassword(); }}
              style={({ pressed }) => [styles.passwordSaveButton, !canSavePassword && styles.passwordSaveButtonDisabled, pressed && canSavePassword && styles.pressed]}>
              <Text style={[styles.passwordSaveText, !canSavePassword && styles.passwordSaveTextDisabled]}>Gem adgangskode</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (showHistoryDetails) {
    return (
      <SafeAreaView edges={Platform.OS === 'web' ? undefined : ['top']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.page}>
          <View style={styles.historyDetailHeader}>
            <Pressable accessibilityRole="button" onPress={() => setShowHistoryDetails(false)} style={styles.historyDetailBack}>
              <ChevronLeft color={colors.blue} size={25} strokeWidth={2.5} />
              <Text style={styles.cartBackText}>Historik</Text>
            </Pressable>
          </View>
          <Text style={styles.historyDetailTitle}>Registreringer</Text>
          <Text style={styles.historyDetailSubtitle}>{formatPurchasePeriod(historyPeriodStart, historyPeriodEnd)} · {historyRegistrationCount} registreringer</Text>

          <ScrollView style={styles.historyDetailScroll} contentContainerStyle={styles.historyDetailList} showsVerticalScrollIndicator={false}>
            {groupedHistory.map((day) => {
              const dayTotal = day.purchases.reduce((total, item) => total + Number(item.total_price), 0);
              const latestPurchase = day.purchases[0];
              const timeLabel = latestPurchase
                ? new Date(latestPurchase.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <View key={getPurchaseDayKey(day.date)} style={styles.historyDetailCard}>
                  <View style={styles.historyDetailDayHeader}>
                    <Text style={styles.historyDetailDayTitle}>{formatPurchaseDay(day.date)} · {timeLabel}</Text>
                    <Text style={styles.historyDetailDayTotal}>{dayTotal.toFixed(0)} kr</Text>
                  </View>
                  {day.purchases.map((item) => {
                    const product = products.find((candidate) => candidate.name === item.product_name);
                    return (
                      <View key={item.id} style={styles.historyDetailRow}>
                        <View style={[styles.historyIcon, { backgroundColor: product?.color ?? '#E5E9FF' }]}>
                            {product?.imageUrl
                              ? <Image contentFit="cover" source={{ uri: product.imageUrl }} style={styles.historyImage} />
                              : <CupSoda color="#142A8F" size={21} strokeWidth={1.8} />}
                        </View>
                        <View style={styles.historyProductInfo}>
                          <Text numberOfLines={1} style={styles.historyDetailProductName}>{item.product_name}</Text>
                          <Text style={styles.productDetails}>{item.amount} × {Number(item.unit_price).toFixed(0)} kr</Text>
                        </View>
                        <Text style={styles.historyDetailPurchaseTotal}>{Number(item.total_price).toFixed(0)} kr</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
            {selectedHistory.length === 0 && <Text style={styles.historyEmptyText}>Der er ingen registreringer i denne periode.</Text>}
          </ScrollView>

          <View style={[styles.bottomNav, Platform.OS !== 'web' && { paddingBottom: safeAreaInsets.bottom }]}>
            <TabButton label="Produkter" active={false} onPress={() => { setShowHistoryDetails(false); setActiveTab('products'); }}>
              <LayoutGrid color={colors.muted} size={23} strokeWidth={2} />
            </TabButton>
            <TabButton label="Favoritter" active={false} onPress={() => { setShowHistoryDetails(false); setActiveTab('favorites'); }}>
              <Heart color={colors.muted} size={23} strokeWidth={2} />
            </TabButton>
            <TabButton label="Historik" active onPress={() => setShowHistoryDetails(false)}>
              <Clock3 color={colors.blue} size={23} strokeWidth={2} />
            </TabButton>
            <TabButton label="Indstillinger" active={false} onPress={() => { setShowHistoryDetails(false); setActiveTab('settings'); }}>
              <SlidersHorizontal color={colors.muted} size={23} strokeWidth={2} />
            </TabButton>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={Platform.OS === 'web' ? undefined : ['top']} style={styles.safeArea}>
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

        <View style={styles.content}>
          {!!catalogError && <Text accessibilityRole="alert" style={styles.catalogError}>{catalogError}</Text>}
          {(activeTab === 'products' || activeTab === 'favorites') && (
            Platform.OS !== 'web' && activeTab === 'favorites' && !catalogLoading && favorites.length === 0 ? (
              <View style={styles.emptyFavoritesState}>
                <View style={styles.emptyFavoritesIcon}>
                  <Heart color={colors.favorite} size={27} strokeWidth={2.2} />
                </View>
                <Text style={styles.emptyFavoritesTitle}>Ingen favoritter endnu</Text>
                <Text style={styles.emptyFavoritesText}>Tryk på hjertet ved et produkt for at gemme det her.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { setActiveTab('products'); setActiveCategory('Alle'); setSearch(''); }}
                  style={styles.emptyFavoritesAction}>
                  <Text style={styles.emptyFavoritesActionText}>Se produkter</Text>
                </Pressable>
              </View>
            ) : <ScrollView
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
                      style={[styles.categoryChip, { width: categoryWidths[category] ?? 100 }, activeCategory === category && styles.categoryChipActive]}>
                      <Text numberOfLines={1} style={[styles.categoryText, activeCategory === category && styles.categoryTextActive]}>{category}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={[styles.productList, activeTab === 'favorites' && styles.favoriteProductList]}>
                {catalogLoading ? <ActivityIndicator color={colors.blue} /> : (
                  shownProducts.map((product) => (
                    <View key={product.id} style={styles.productCard}>
                      <Pressable accessibilityRole="button" onPress={() => openProduct(product)} style={styles.productMain}>
                        <View style={[styles.productIcon, { backgroundColor: product.color }]}>
                          {product.imageUrl
                            ? <Image contentFit="cover" source={{ uri: product.imageUrl }} style={styles.productImage} />
                            : <CupSoda color="#142A8F" size={27} strokeWidth={1.8} />}
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
                        onPress={() => { void toggleFavorite(product.id); }}
                        style={styles.favoriteButton}>
                        <Heart
                          color={favorites.includes(product.id) ? colors.favorite : colors.muted}
                          fill={favorites.includes(product.id) ? colors.favorite : 'transparent'}
                          size={20}
                          strokeWidth={2}
                        />
                      </Pressable>
                    </View>
                  ))
                )}
                {!catalogLoading && shownProducts.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>{activeTab === 'favorites' ? 'Ingen favoritter endnu' : 'Ingen produkter fundet'}</Text>
                    <Text style={styles.emptyText}>Prøv en anden søgning eller kategori.</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {activeTab === 'history' && (
            <ScrollView contentContainerStyle={styles.historyPage}>
              <View style={styles.historySummaryCard}>
                <View style={styles.historyPeriodHeader}>
                  <CalendarDays color={colors.blue} size={24} strokeWidth={2} />
                  <View style={styles.historyPeriodCopy}>
                    <Text style={styles.historyPeriodLabel}>Periode</Text>
                    <Text style={styles.historyPeriodValue}>{formatPurchasePeriod(historyPeriodStart, historyPeriodEnd)}</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={openHistoryPeriodPicker} style={styles.historyPeriodChangeButton}>
                    <Text style={styles.historyPeriodChangeText}>Skift</Text>
                  </Pressable>
                </View>
                <View style={styles.historySummaryBody}>
                  <View>
                    <Text style={styles.historySummaryLabel}>I alt i perioden</Text>
                    <Text style={styles.historySummaryAmount}>{historyPeriodTotal.toFixed(0)} kr</Text>
                  </View>
                  <View style={styles.historySummaryCount}>
                    <Text style={styles.historySummaryLabel}>Varer</Text>
                    <Text style={styles.historySummaryCountValue}>{historyPeriodItemCount}</Text>
                  </View>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setShowHistoryDetails(true)} style={styles.historySummaryLink}>
                  <Text style={styles.historySummaryLinkText}>Se registreringer</Text>
                  <ChevronRight color={colors.blue} size={22} />
                </Pressable>
              </View>

              <Text style={styles.historySectionTitle}>Din historik</Text>
              <View style={styles.historyListCard}>
                {groupedHistory.map((day, dayIndex) => (
                  <View key={getPurchaseDayKey(day.date)} style={[styles.historyDayGroup, dayIndex < groupedHistory.length - 1 && styles.historyDayDivider]}>
                    <Text style={styles.historyDayTitle}>{formatPurchaseDay(day.date)}</Text>
                    {day.purchases.map((item) => {
                      const product = products.find((candidate) => candidate.name === item.product_name);
                      return (
                        <View key={item.id} style={styles.historyRow}>
                          <View style={[styles.historyIcon, { backgroundColor: product?.color ?? '#E5E9FF' }]}>
                            {product?.imageUrl
                              ? <Image contentFit="cover" source={{ uri: product.imageUrl }} style={styles.historyImage} />
                              : <CupSoda color="#142A8F" size={21} strokeWidth={1.8} />}
                          </View>
                          <View style={styles.historyProductInfo}>
                            <Text numberOfLines={1} style={styles.productName}>{item.product_name}</Text>
                            <Text style={styles.productDetails}>{item.amount} × {Number(item.unit_price).toFixed(0)} kr</Text>
                          </View>
                          <Text style={styles.historyPurchaseTotal}>{Number(item.total_price).toFixed(0)} kr</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
                {selectedHistory.length === 0 && <Text style={styles.historyEmptyText}>Der er ingen registreringer i denne periode.</Text>}
              </View>
            </ScrollView>
          )}

          {activeTab === 'settings' && (
            <ScrollView contentContainerStyle={styles.settingsContent} showsVerticalScrollIndicator={false}>
              <View style={styles.profileCard}>
                <View style={styles.avatarRow}>
                  <View style={styles.profileAvatar}><UserRound color={colors.blue} size={30} strokeWidth={1.8} /></View>
                </View>

                <Text style={styles.settingsLabel}>Navn</Text>
                <Text style={styles.settingsInput}>{employeeProfile?.display_name || 'Ikke angivet'}</Text>
                <Text style={styles.settingsLabel}>E-mail</Text>
                <Text style={styles.settingsInput}>{employeeProfile?.email || 'Ikke angivet'}</Text>

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
                    <Text style={styles.companyDepartmentValue}>{employeeProfile?.companyName || 'Ikke angivet'}</Text>
                  </View>
                  <View style={styles.companyDepartmentCell}>
                    <Text style={styles.companyDepartmentLabel}>Afdeling</Text>
                    <Text style={styles.companyDepartmentValue}>{employeeProfile?.departmentName || 'Ikke tildelt'}</Text>
                  </View>
                </View>

                {!!profileNotice && <Text accessibilityRole="text" style={styles.settingsNotice}>{profileNotice}</Text>}
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

        <View style={[styles.bottomNav, Platform.OS !== 'web' && { paddingBottom: safeAreaInsets.bottom }]}>
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
                  {selectedProduct.imageUrl
                    ? <Image contentFit="cover" source={{ uri: selectedProduct.imageUrl }} style={styles.detailProductImage} />
                    : <CupSoda color="#142A8F" size={78} strokeWidth={1.5} />}
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
              Kontakt din virksomhedsadministrator for at få slettet din profil. Dine registreringer håndteres efter virksomhedens dataregler.
            </Text>
            <Pressable accessibilityRole="button" onPress={submitDeleteRequest} style={({ pressed }) => [styles.deleteConfirmButton, pressed && styles.pressed]}>
              <Text style={styles.deleteConfirmText}>Forstået</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setShowDeleteConfirm(false)} style={styles.deleteCancelButton}>
              <Text style={styles.deleteCancelText}>Fortryd</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={showHistoryPeriodPicker} onRequestClose={() => setShowHistoryPeriodPicker(false)}>
        <View style={styles.historyPickerBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Luk periodevælger" onPress={() => setShowHistoryPeriodPicker(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.historyPickerSheet, { paddingBottom: Math.max(safeAreaInsets.bottom, 20) }]}>
            <View style={styles.historyPickerHeader}>
              <Text style={styles.historyPickerTitle}>Vælg periode</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Luk" onPress={() => setShowHistoryPeriodPicker(false)} style={styles.historyPickerClose}>
                <X color={colors.ink} size={20} />
              </Pressable>
            </View>
            <View style={styles.historyQuickFilters}>
              <Pressable accessibilityRole="button" onPress={() => setHistoryPreset('last-seven-days')} style={styles.historyQuickFilter}>
                <Text style={styles.historyQuickFilterText}>Sidste 7 dage</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setHistoryPreset('standard')} style={styles.historyQuickFilter}>
                <Text style={styles.historyQuickFilterText}>Standard</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setHistoryPreset('this-year')} style={styles.historyQuickFilter}>
                <Text style={styles.historyQuickFilterText}>I år</Text>
              </Pressable>
            </View>

            <View style={styles.historyDateFields}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: activePeriodField === 'from' }} onPress={() => setActivePeriodField('from')} style={[styles.historyDateField, activePeriodField === 'from' && styles.historyDateFieldActive]}>
                <View style={styles.historyDateFieldCopy}>
                  <Text style={styles.historyDateFieldLabel}>Fra</Text>
                  <Text style={styles.historyDateFieldValue}>{formatPickerDate(draftPeriodStart)}</Text>
                </View>
                <ChevronDown color={colors.muted} size={19} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: activePeriodField === 'to' }} onPress={() => setActivePeriodField('to')} style={[styles.historyDateField, activePeriodField === 'to' && styles.historyDateFieldActive]}>
                <View style={styles.historyDateFieldCopy}>
                  <Text style={styles.historyDateFieldLabel}>Til</Text>
                  <Text style={styles.historyDateFieldValue}>{formatPickerDate(draftPeriodEnd)}</Text>
                </View>
                <ChevronDown color={colors.muted} size={19} />
              </Pressable>
            </View>

            <Text style={styles.historyCalendarPrompt}>{activePeriodField === 'from' ? 'Vælg startdato' : 'Vælg slutdato'}</Text>
            <View style={styles.historyCalendarNavigation}>
              <Pressable accessibilityRole="button" accessibilityLabel="Forrige måned" onPress={() => setCalendarMonth((month) => shiftCalendarMonth(month, -1))} style={styles.historyCalendarArrow}>
                <ChevronLeft color={colors.ink} size={22} />
              </Pressable>
              <Text style={styles.historyCalendarRangeTitle}>
                {calendarMonths[0].toLocaleDateString('da-DK', { month: 'short' }).replace(/\./g, '')} – {calendarMonths[1].toLocaleDateString('da-DK', { month: 'short', year: 'numeric' }).replace(/\./g, '')}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Næste måned" onPress={() => setCalendarMonth((month) => shiftCalendarMonth(month, 1))} style={styles.historyCalendarArrow}>
                <ChevronRight color={colors.ink} size={22} />
              </Pressable>
            </View>

            <ScrollView style={styles.historyCalendarScroll} contentContainerStyle={styles.historyCalendarContent} showsVerticalScrollIndicator={false}>
              {calendarMonths.map((month) => (
                <View key={`${month.getFullYear()}-${month.getMonth()}`} style={styles.historyCalendarMonth}>
                  <Text style={styles.historyCalendarMonthLabel}>{formatCalendarMonth(month)}</Text>
                  <View style={styles.historyCalendarWeek}>
                    {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map((weekday) => (
                      <Text key={weekday} style={styles.historyCalendarWeekday}>{weekday}</Text>
                    ))}
                  </View>
                  {getCalendarWeeks(month).map((week, weekIndex) => (
                    <View key={weekIndex} style={styles.historyCalendarWeek}>
                      {week.map((date, dayIndex) => {
                        if (!date) return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.historyCalendarDayCell} />;
                        const isStart = getPurchaseDayKey(date) === getPurchaseDayKey(draftPeriodStart);
                        const isEnd = getPurchaseDayKey(date) === getPurchaseDayKey(draftPeriodEnd);
                        const isSelected = isStart || isEnd;
                        const isInRange = isInDraftHistoryPeriod(date);
                        return (
                          <View key={getPurchaseDayKey(date)} style={[styles.historyCalendarDayCell, isInRange && styles.historyCalendarDayInRange]}>
                            <Pressable accessibilityRole="button" accessibilityLabel={formatPickerDate(date)} accessibilityState={{ selected: isSelected }} onPress={() => selectHistoryDate(date)} style={[styles.historyCalendarDayButton, isSelected && styles.historyCalendarDaySelected]}>
                              <Text style={[styles.historyCalendarDayNumber, isInRange && styles.historyCalendarDayNumberInRange, isSelected && styles.historyCalendarDayNumberSelected]}>{date.getDate()}</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>

            <Pressable accessibilityRole="button" onPress={applyHistoryPeriod} style={styles.historyApplyButton}>
              <Text style={styles.historyApplyButtonText}>Vis periode</Text>
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
  cartPageProductImage: { width: '100%', height: '100%', borderRadius: 16 },
  cartPageProductInfo: { flex: 1, minWidth: 48, gap: 3 },
  cartPageQuantity: { minWidth: 18, color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  cartQuantityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D5DDE5', borderRadius: 22, backgroundColor: colors.white },
  cartPlusButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.blue },
  cartPageLineTotal: { width: 48, color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  cartPageFooter: { paddingTop: 12 },
  cartPageTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E8EDF2' },
  cartPageTotalLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  cartPageTotalPrice: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  cartSwipeTrack: { height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingLeft: 78, paddingRight: 12, borderRadius: 40, backgroundColor: '#E2E7FF', overflow: 'hidden' },
  cartSwipeLabel: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  cartSwipeThumb: { position: 'absolute', top: 5, left: 5, width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 35, backgroundColor: colors.blue },
  cartDemoNotice: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  pageTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  cartButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  cartBadge: { position: 'absolute', top: -1, right: -1, minWidth: 19, height: 19, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.blue },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  catalogError: { marginBottom: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, color: '#A52B28', backgroundColor: '#FCE9E7', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.78 },
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
  favoriteProductList: { paddingTop: 14 },
  productCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.white },
  productMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 13 },
  productIcon: { width: 58, height: 58, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  productImage: { width: '100%', height: '100%', borderRadius: 15 },
  productInfo: { flex: 1, minWidth: 0, gap: 3 },
  productName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  productDetails: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  quickAddButton: { width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#E8ECFF' },
  favoriteButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', gap: 6, paddingVertical: 36 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  emptyFavoritesState: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 44 },
  emptyFavoritesIcon: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderRadius: 40, backgroundColor: '#FDEBDD' },
  emptyFavoritesTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  emptyFavoritesText: { maxWidth: 310, color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 14 },
  emptyFavoritesAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  emptyFavoritesActionText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  historyPage: { gap: 22, paddingBottom: 20 },
  historyDetailHeader: { minHeight: 44, justifyContent: 'center', marginBottom: 18 },
  historyDetailBack: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  historyDetailTitle: { color: colors.ink, fontSize: 40, lineHeight: 48, fontWeight: '700' },
  historyDetailSubtitle: { color: colors.muted, fontSize: 15, fontWeight: '600', marginTop: 4, marginBottom: 20 },
  historyDetailScroll: { flex: 1 },
  historyDetailList: { gap: 18, paddingBottom: 14 },
  historyDetailCard: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 26, backgroundColor: colors.white },
  historyDetailDayHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  historyDetailDayTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600' },
  historyDetailDayTotal: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  historyDetailRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14 },
  historyDetailProductName: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  historyDetailPurchaseTotal: { color: colors.muted, fontSize: 15, fontWeight: '500' },
  historySummaryCard: { borderWidth: 1, borderColor: '#D5DDE5', borderRadius: 28, backgroundColor: colors.white, overflow: 'hidden' },
  historyPeriodHeader: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, backgroundColor: '#F5F7F9' },
  historyPeriodCopy: { flex: 1, gap: 3 },
  historyPeriodLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  historyPeriodValue: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  historyPeriodChangeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 22, backgroundColor: '#E2E7FF' },
  historyPeriodChangeText: { color: colors.blue, fontSize: 14, fontWeight: '700' },
  historySummaryBody: { minHeight: 116, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  historySummaryLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  historySummaryAmount: { color: colors.ink, fontSize: 40, lineHeight: 46, fontWeight: '700' },
  historySummaryCount: { alignItems: 'flex-end', gap: 4 },
  historySummaryCountValue: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  historySummaryLink: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, borderTopWidth: 1, borderTopColor: '#E8EDF2' },
  historySummaryLinkText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  historySectionTitle: { color: colors.ink, fontSize: 23, fontWeight: '700' },
  historyListCard: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 26, backgroundColor: colors.white },
  historyDayGroup: { paddingTop: 16, paddingBottom: 10 },
  historyDayDivider: { borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  historyDayTitle: { color: colors.muted, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  historyRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14 },
  historyIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  historyImage: { width: '100%', height: '100%', borderRadius: 16 },
  historyProductInfo: { flex: 1, minWidth: 0, gap: 3 },
  historyPurchaseTotal: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  historyEmptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, paddingVertical: 24, textAlign: 'center' },
  historyPickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 27, 55, 0.35)' },
  historyPickerSheet: { height: '92%', maxHeight: '92%', paddingHorizontal: 24, paddingTop: 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.white },
  historyPickerHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  historyPickerTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  historyPickerClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.background },
  historyQuickFilters: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  historyQuickFilter: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: '#D5DDE5', borderRadius: 24, backgroundColor: colors.white },
  historyQuickFilterText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  historyDateFields: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  historyDateField: { minHeight: 82, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#D5DDE5', borderRadius: 20, backgroundColor: colors.white },
  historyDateFieldActive: { borderWidth: 2, borderColor: colors.blue },
  historyDateFieldCopy: { flex: 1, gap: 4 },
  historyDateFieldLabel: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  historyDateFieldValue: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  historyCalendarPrompt: { color: colors.muted, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  historyCalendarNavigation: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  historyCalendarArrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.background },
  historyCalendarRangeTitle: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  historyCalendarScroll: { flexShrink: 1, minHeight: 0 },
  historyCalendarContent: { paddingBottom: 10 },
  historyCalendarMonth: { marginBottom: 14 },
  historyCalendarMonthLabel: { color: colors.ink, fontSize: 16, fontWeight: '600', marginHorizontal: 4, marginBottom: 8 },
  historyCalendarWeek: { flexDirection: 'row', alignItems: 'center' },
  historyCalendarWeekday: { height: 34, flex: 1, color: colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'center', textAlignVertical: 'center' },
  historyCalendarDayCell: { height: 46, flex: 1, alignItems: 'center', justifyContent: 'center' },
  historyCalendarDayInRange: { backgroundColor: '#E2E7FF' },
  historyCalendarDayButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  historyCalendarDaySelected: { backgroundColor: colors.blue },
  historyCalendarDayNumber: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  historyCalendarDayNumberInRange: { color: '#152A9C' },
  historyCalendarDayNumberSelected: { color: colors.white, fontWeight: '700' },
  historyApplyButton: { minHeight: 68, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 34, backgroundColor: colors.blue },
  historyApplyButtonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  historyPeriodOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  historyPeriodOptionSelected: { backgroundColor: '#F3F5FF' },
  historyPeriodOptionText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '500' },
  historyPeriodOptionTextSelected: { color: colors.blue, fontWeight: '700' },
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
  registrationSuccessBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 31, 74, 0.56)' },
  registrationSuccessSheet: { width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.white },
  registrationSuccessIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: colors.green },
  registrationSuccessTitle: { color: colors.ink, fontSize: 25, lineHeight: 32, fontWeight: '700', textAlign: 'center' },
  registrationSuccessText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 4 },
  registrationSuccessPrimary: { width: '100%', minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: colors.blue },
  registrationSuccessPrimaryText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  registrationSuccessSecondary: { width: '100%', minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 27, backgroundColor: colors.white },
  registrationSuccessSecondaryText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  deleteModalTitle: { color: colors.ink, fontSize: 20, lineHeight: 27, fontWeight: '700', textAlign: 'center' },
  deleteModalText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
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
  detailProductImage: { width: '100%', height: '100%', borderRadius: 28 },
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