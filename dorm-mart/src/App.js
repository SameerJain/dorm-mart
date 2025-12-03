// dorm-mart/src/App.js

// essentials
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import RootLayout from "./pages/RootLayout";
// auth
import LoginPage from "./pages/LoginPage";
import WelcomePage from "./pages/WelcomePage";
import LandingPage from "./pages/HomePage/LandingPage";
import ForgotPasswordPage from './pages/ForgotPasswordPage.js';
import ResetPasswordConfirmation from './pages/ResetPassword/ResetPasswordConfirmation.jsx';
import ForgotPasswordConfirmation from './pages/ResetPassword/ForgotPasswordConfirmation.jsx';
import ResetPasswordForm from './pages/ResetPassword/ResetPasswordForm.jsx';
// app
import PurchaseHistoryPage from "./pages/PurchaseHistory/PurchaseHistoryPage";
import PurchaseHistoryLayout from "./pages/PurchaseHistory/PurchaseHistoryLayout";
import ProductListingPage from "./pages/ItemForms/ProductListingPage.jsx";
import CreateAccount from "./pages/AccountCreation/index.jsx";
import ChangePasswordPage from "./pages/Settings/ChangePassword.jsx";
import MyProfilePage from "./pages/Settings/MyProfile.jsx";
import BuyerReviewsPage from "./pages/Settings/BuyerReviewsPage.jsx";
import UserPreferences from "./pages/Settings/UserPreferences.jsx";
import ItemDetailPage from "./pages/PurchaseHistory/ItemDetailPage.js"
import SellerDashboardPage from "./pages/SellerDashboard/SellerDashboardPage.jsx";
import SchedulePurchasePage from "./pages/SellerDashboard/SchedulePurchasePage.jsx";
import ConfirmPurchasePage from "./pages/SellerDashboard/ConfirmPurchasePage.jsx";
import OngoingPurchasesPage from "./pages/SellerDashboard/OngoingPurchasesPage.jsx";
import MarkCompletedPage from "./pages/SellerDashboard/MarkCompletedPage.jsx";
import ReportIssuePage from "./pages/SellerDashboard/ReportIssuePage.jsx";
import ViewProduct from "./itemDetails/viewProduct.jsx";
import ViewReceipt from "./itemDetails/viewReceipt.jsx";
import SearchResults from "./pages/search/searchResults.jsx";
import WishlistPage from "./pages/Wishlist/WishlistPage.jsx";
import PublicProfilePage from "./pages/public_profile/PublicProfilePage.jsx";
// Chat
import { ChatProvider } from "./context/ChatContext.js";
import ChatPage from "./pages/Chat/ChatPage.jsx";
// Notification
import NotificationPage from "./pages/Notification/NotificationPage.jsx";
// FAQ
import FAQPage from "./pages/FAQPage/FAQPage.jsx";

export const router = createHashRouter([
  // Welcome page
  { path: "/", element: <WelcomePage /> },

  // Auth
  { path: "/login", element: <LoginPage /> },
  { path: "/create-account", element: <CreateAccount /> },
  { path: "/forgot-password", element: <ForgotPasswordPage />},
  { path: "/forgot-password/confirmation", element: <ForgotPasswordConfirmation />},
  { path: "/reset-password", element: <ResetPasswordForm /> },
  { path: "/reset-password/confirmation", element: <ResetPasswordConfirmation /> },
  // Main app
  {
    path: "/app",
    element: (
      <ChatProvider>
        <RootLayout />
      </ChatProvider>
    ),
    children: [
      { index: true,
        element: <LandingPage /> 
      },
        // Search Results
        { path: "listings", element: <SearchResults /> },
        // Product Listing
        {
          path: "product-listing",
          children: [
            { index: true, element: <ProductListingPage /> },
            { path: "new", element: <ProductListingPage key="new" /> },
            { path: "edit/:id", element: <ProductListingPage key="edit" /> },
          ],
        },
        // View Product
        { path: "viewProduct", element: <ViewProduct /> },
        { path: "viewProduct/:id", element: <ViewProduct /> },
        { path: "viewproduct", element: <ViewProduct /> },
        { path: "viewproduct/:id", element: <ViewProduct /> },
        { path: "viewReceipt", element: <ViewReceipt /> },
        { path: "viewReceipt/:id", element: <ViewReceipt /> },
        { path: "viewreceipt", element: <ViewReceipt /> },
        { path: "viewreceipt/:id", element: <ViewReceipt /> },
        {
          path: "purchase-history",
          element: <PurchaseHistoryLayout />,
          children: [
            { index: true, element: <PurchaseHistoryPage /> },
            { path: "item-detail/:id", element: <ItemDetailPage /> },
          ],
        },
        {
          path: "notification",
          children: [
            { index: true, element: < NotificationPage />}
          ] 
        },
        {
          path: "chat",
          children: [
            { index: true, element: < ChatPage/>}
          ]
        },
        // Wishlist
        {
          path: "wishlist",
          element: <WishlistPage />,
        },
        {
          path: "profile",
          element: <PublicProfilePage />,
        },
        // Seller Dashboard
        {
          path: "seller-dashboard",
          element: <SellerDashboardPage />,
        },
        {
          path: "seller-dashboard/schedule-purchase",
          element: <SchedulePurchasePage />,
        },
        {
          path: "seller-dashboard/confirm-purchase",
          element: <ConfirmPurchasePage />,
        },
        {
          path: "seller-dashboard/ongoing-purchases",
          element: <OngoingPurchasesPage />,
        },
        {
          path: "scheduled-purchases/mark-completed/:requestId",
          element: <MarkCompletedPage />,
        },
        {
          path: "scheduled-purchases/report-issue/:requestId",
          element: <ReportIssuePage />,
        },
        // Settings (under /app)
        {
          path: "setting",
          children: [
            { index: true, element: <Navigate to="/app/setting/my-profile" replace /> },
            { path: "my-profile", element: <MyProfilePage /> },
            { path: "change-password", element: <ChangePasswordPage /> },
            { path: "buyer-reviews", element: <BuyerReviewsPage /> },
            // User Preferences
            { path: "user-preferences", element: <UserPreferences /> },
            // Stubs for yet-to-be-implemented pages (intentionally 404)
            {
              path: "personal-information",
              loader: () => {
                throw new Response("Not Found", { status: 404 });
              },
            },
            {
              path: "security-options",
              loader: () => {
                throw new Response("Not Found", { status: 404 });
              },
            },
          ],
        },
        {
          path: "faq",
          element: <FAQPage />,
        },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
