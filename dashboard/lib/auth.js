import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return { id: data.user.id, email: data.user.email, name: data.user.name, role: data.user.role || 'user', token: data.token };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        // NOTE: The Google OAuth app is in "Testing" mode in Google Cloud Console.
        // Only explicitly added test users can sign in until the app is published.
        // To add test users: Google Cloud Console → APIs & Services → OAuth consent screen
        // → Test users → Add users → add your own Google account
        try {
          const res = await fetch(`${API_URL}/api/auth/google-signin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
            },
            body: JSON.stringify({
              email: user.email,
              google_id: account.providerAccountId,
              name: user.name,
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            console.error('[auth] google-signin API error:', res.status, body);
            return `/auth/login?error=GoogleSignInFailed`;
          }
          const data = await res.json();
          // Inject our DB user data into the user object so jwt callback can read it
          user.id    = data.user.id;
          user.role  = data.user.role || 'user';
          user.token = data.token;
        } catch (err) {
          console.error('[auth] google-signin fetch failed:', err);
          return `/auth/login?error=GoogleSignInFailed`;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.token) token.accessToken = user.token;
      if (user?.role)  token.role        = user.role;
      if (user?.id)    token.userId      = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.accessToken  = token.accessToken;
        session.user.role    = token.role || 'user';
        session.user.id      = token.userId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: { strategy: 'jwt' },
};

export default NextAuth(authOptions);
