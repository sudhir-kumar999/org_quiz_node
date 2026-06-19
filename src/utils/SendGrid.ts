import sgMail from '@sendgrid/mail'
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string)

const key = process.env.SENDGRID_API_KEY;
export const sendGrid = (to: string, template: string) => {
  sgMail.setApiKey(key as string);
  const msg = {
    to: to,
    from: "akumar07067@gmail.com",
    subject: "Sending mail to verify your email",
    html: template,
  };

sgMail
  .send(msg)
  .then((response) => {
    console.log(response[0].statusCode)
    console.log(response[0].headers)
  })
  .catch((error) => {
    console.error(error)
  })
}