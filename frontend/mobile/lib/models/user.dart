enum UserRole { systemAdmin, orgAdmin, firstResponder }

UserRole parseRole(String raw) {
  switch (raw) {
    case 'system_admin':    return UserRole.systemAdmin;
    case 'org_admin':       return UserRole.orgAdmin;
    case 'first_responder': return UserRole.firstResponder;
    default:                return UserRole.firstResponder;
  }
}

class AppUser {
  final String id;
  final String name;
  final String email;
  final UserRole role;
  final String? org;
  final String accessToken;
  final String refreshToken;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.org,
    required this.accessToken,
    required this.refreshToken,
  });
}
