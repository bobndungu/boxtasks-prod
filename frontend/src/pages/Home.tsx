import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Layout, Users, Zap } from 'lucide-react';

interface ApiStatus {
  connected: boolean;
  message: string;
}

export default function Home() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ connected: false, message: 'Checking...' });

  useEffect(() => {
    // Test connection to Drupal JSON:API
    const checkApi = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/jsonapi`, {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.api+json',
          },
        });
        if (response.ok) {
          setApiStatus({ connected: true, message: 'Connected to Drupal API' });
        } else {
          setApiStatus({ connected: false, message: `API Error: ${response.status}` });
        }
      } catch (error) {
        setApiStatus({ connected: false, message: 'Cannot connect to API' });
      }
    };
    checkApi();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layout className="h-8 w-8 text-white" />
            <span className="text-2xl font-bold text-white">BoxTasks</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/login"
              className="text-white hover:text-blue-200 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              Sign up free
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Organize your work,
            <br />
            <span className="text-blue-200">your way</span>
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            BoxTasks brings all your tasks, teammates, and tools together.
            Keep everything in the same place—even if your team isn't.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors"
            >
              Get Started - It's Free
            </Link>
            <a
              href="#features"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* API Status */}
        <div className="mt-12 flex justify-center">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
            apiStatus.connected ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              apiStatus.connected ? 'bg-green-400' : 'bg-red-400'
            }`}></div>
            <span className="text-sm">{apiStatus.message}</span>
          </div>
        </div>
      </main>

      {/* Features */}
      <section id="features" className="bg-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            Everything you need to manage projects
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={<Layout className="h-8 w-8 text-blue-600" />}
              title="Boards & Cards"
              description="Visualize your projects with customizable boards. Drag and drop cards to track progress."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-blue-600" />}
              title="Team Collaboration"
              description="Work together in real-time. Assign tasks, leave comments, and stay in sync."
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-blue-600" />}
              title="Automation"
              description="Automate repetitive tasks with Butler automation. Focus on what matters."
            />
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-500 mb-6">Built with modern technology</p>
          <div className="flex flex-wrap justify-center gap-8 text-gray-600">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Drupal 11
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              React + TypeScript
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              JSON:API
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Real-time with Mercure
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Layout className="h-6 w-6" />
            <span className="text-xl font-bold text-white">BoxTasks</span>
          </div>
          <p>© 2024 BoxTasks. Built with Drupal 11 + React.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
