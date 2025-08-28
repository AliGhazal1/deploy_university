import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Users, BookOpen, ArrowRight } from 'lucide-react';
import AuthModal from './AuthModal';

const Survey: React.FC = () => {
  const [step, setStep] = useState(1);
  const [university, setUniversity] = useState('');
  const [role, setRole] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  const universities = [
    { name: 'University of Calgary', code: 'UC', icon: GraduationCap },
    { name: 'Mount Royal University', code: 'MRU', icon: BookOpen },
    { name: 'Bow Valley College', code: 'BVC', icon: Users },
    { name: "St. Mary's University", code: 'SMU', icon: GraduationCap }
  ];

  const roles = [
    { name: 'Student', icon: GraduationCap, description: 'Undergraduate or Graduate' },
    { name: 'Professor', icon: Users, description: 'Teaching Faculty' },
    { name: 'Faculty', icon: BookOpen, description: 'Academic Staff' }
  ];

  const handleUniversitySelect = (uni: string) => {
    setUniversity(uni);
    setStep(2);
  };

  const handleRoleSelect = (selectedRole: string) => {
    setRole(selectedRole);
  };

  const handleContinue = () => {
    if (university && role) {
      setShowAuth(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <GraduationCap className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">University Connect</h1>
            <p className="text-gray-600">Connect with your academic community</p>
          </div>

          <div className="mb-6 flex justify-end">
            <button
              onClick={() => setShowAuth(true)}
              className="rounded-lg bg-blue-600 px-5 py-2 text-white shadow hover:bg-blue-700 transition-colors"
            >
              Log In
            </button>
          </div>

          {step === 1 && (
            <div>
              <h2 className="text-2xl font-semibold text-center mb-8 text-gray-800">
                What University Are You From?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {universities.map((uni) => {
                  const IconComponent = uni.icon;
                  return (
                    <button
                      key={uni.code}
                      onClick={() => handleUniversitySelect(uni.name)}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 flex items-center space-x-4 group"
                    >
                      <IconComponent className="w-8 h-8 text-gray-600 group-hover:text-blue-600" />
                      <span className="text-lg font-medium text-gray-800 group-hover:text-blue-800">
                        {uni.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <button 
                onClick={() => setStep(1)}
                className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
              >
                ← Back
              </button>
              <h2 className="text-2xl font-semibold text-center mb-2 text-gray-800">
                What Are You?
              </h2>
              <p className="text-center text-gray-600 mb-8">Selected: {university}</p>
              <div className="space-y-4">
                {roles.map((roleOption) => {
                  const IconComponent = roleOption.icon;
                  return (
                    <button
                      key={roleOption.name}
                      onClick={() => handleRoleSelect(roleOption.name)}
                      className={`w-full p-6 border-2 rounded-lg transition-all duration-200 flex items-center space-x-4 ${
                        role === roleOption.name
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <IconComponent className={`w-8 h-8 ${
                        role === roleOption.name ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                      <div className="text-left">
                        <div className={`text-lg font-medium ${
                          role === roleOption.name ? 'text-blue-800' : 'text-gray-800'
                        }`}>
                          {roleOption.name}
                        </div>
                        <div className="text-sm text-gray-600">{roleOption.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {role && (
                <button
                  onClick={handleContinue}
                  className="w-full mt-8 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2 font-medium"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onAuthed={() => navigate('/dashboard')}
        defaultToSignUp={false}
      />
    </div>
  );
};

export default Survey;