// domain/entities/User.js
class User {
  constructor(
    UserId,
    Username,
    RoleId,
    Password,
    Token,
    TokenDateTime,
    IsActive,
    IsDelete,
    CreatedBy,
    CreatedOn,
    ModifiedBy,
    ModifiedOn,
    twoFACode,
    twoFACodeExpiry
  ) {
    this.UserId = UserId;
    this.Username = Username;
    this.RoleId = RoleId;
    this.Password = Password;
    this.Token = Token;
    this.IsActive = IsActive;
    this.IsDelete = IsDelete;
    this.CreatedBy = CreatedBy;
    this.CreatedOn = CreatedOn;
    this.ModifiedBy = ModifiedBy;
    this.ModifiedOn = ModifiedOn;
    this.twoFACode = twoFACode;
    this.twoFACodeExpiry = twoFACodeExpiry;
  }
}

module.exports = User;
