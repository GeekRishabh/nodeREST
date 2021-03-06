const { get } = require('lodash');
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require('../../models/user.model');
const Token = require('../../models/token.model');
const jwtLib = require('../../utils/jwt');

const sendEmail = require("../thirdParty/mail");
let services = {};

services.signup = async data => {
    let user = await User.findOne({ email: data.email });
    if (user) {
        throw new Error("Email already exist");
    }
    user = new User(data);  
    await user.save();
    const token = jwtLib.createToken(user);
    sendEmail(
      user.email,
      "Welcome to Node REST API",
      {
        fullName: user.fullName,
      },
     "welcome"
    );
    return (data = {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
        token: token,
    });

}

services.login = async data => {
    let user = await User.findOne({ email: data.email });
    if (!user) {
        throw new Error("No such user exist");
    }
  const validPassword = await bcrypt.compare(data.password, user.password);
  if(!validPassword) throw new Error("Invalid password");
  const token = jwtLib.createToken(user)
    return (data = {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
        token: token,
    });   
};

services.passwordResetMail = async data => {
    const user = await User.findOne({ email: data.email });
        if (!user) throw new Error("Email does not exist");
        let token = await Token.findOne({ userId: user._id });
        if (token) await token.deleteOne();
        let resetToken = crypto.randomBytes(32).toString("hex");
        const hash = await bcrypt.hash(resetToken, Number(process.env.BCRYPT_SALT));
        await new Token({
          userId: user._id,
          token: hash,
          createdAt: Date.now(),
        }).save();
        const link = `${process.env.CLIENT_URL}/${process.env.API_PREFIX}/${process.env.API_VERSION}/auth/reset-password?token=${resetToken}&id=${user._id}`;
        sendEmail(
          user.email,
          "Password Reset Request",
          {
            fullName: user.fullName,
            link: link,
          },
         "forgotPassword"
        );
        return link;

}

services.resetPassword = async (query,body) => {
    let passwordResetToken = await Token.findOne({ userId:query.id });
    if (!passwordResetToken) {
      throw new Error("Invalid or expired password reset token");
    }
    const isValid = await bcrypt.compare(query.token, passwordResetToken.token);
    if (!isValid) {
      throw new Error("Invalid or expired password reset token");
    }
    const hash = await bcrypt.hash(body.password, Number(process.env.BCRYPT_SALT));
    await User.updateOne(
      { _id: query.id },
      { $set: { password: hash } },
      { new: true }
    ); 
    const user = await User.findById({ _id: query.id });
    await passwordResetToken.deleteOne();
}

module.exports = services;